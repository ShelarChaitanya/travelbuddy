<?php
require_once 'config.php';
require_once 'auth.php';

setCorsHeaders();

// Get the action from query parameter
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'find':
        handleFindMatches();
        break;
    case 'recent':
        handleRecentMatches();
        break;
    case 'calculate':
        handleCalculateCompatibility();
        break;
    case 'like':
        handleLikeUser();
        break;
    case 'pass':
        handlePassUser();
        break;
    default:
        sendJsonResponse(['error' => 'Invalid action'], 400);
}

function handleFindMatches() {
    global $db;
    
    $userId = requireAuth();
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    
    try {
        // Get user's preferences
        $userPrefs = $db->fetch("
            SELECT p.*, u.location as user_location
            FROM preferences p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = ?
        ", [$userId]);
        
        if (!$userPrefs) {
            sendJsonResponse(['error' => 'Please complete your profile first'], 400);
        }
        
        // Get users who haven't been matched/passed already
        $matches = $db->fetchAll("
            SELECT DISTINCT u.id, u.name, u.age, u.gender, u.bio, u.profile_photo, 
                   u.location, u.created_at,
                   p.preferred_destinations, p.travel_dates_start, p.travel_dates_end,
                   p.budget_min, p.budget_max, p.interests, p.travel_style,
                   p.group_size_preference, p.languages_spoken
            FROM users u
            JOIN preferences p ON u.id = p.user_id
            WHERE u.id != ? 
            AND u.status = 'active'
            AND u.id NOT IN (
                SELECT CASE 
                    WHEN user1_id = ? THEN user2_id 
                    ELSE user1_id 
                END
                FROM matches 
                WHERE (user1_id = ? OR user2_id = ?)
            )
            AND u.id NOT IN (
                SELECT blocked_id FROM user_blocks WHERE blocker_id = ?
            )
            AND u.id NOT IN (
                SELECT blocker_id FROM user_blocks WHERE blocked_id = ?
            )
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        ", [$userId, $userId, $userId, $userId, $userId, $userId, $limit, $offset]);
        
        // Calculate compatibility scores
        $matchesWithScores = [];
        foreach ($matches as $match) {
            $compatibilityData = calculateCompatibilityScore($userPrefs, $match);
            $match['compatibility_score'] = $compatibilityData['score'];
            $match['match_factors'] = $compatibilityData['factors'];
            
            // Parse JSON fields
            $match['preferred_destinations'] = json_decode($match['preferred_destinations'] ?? '[]', true);
            $match['interests'] = json_decode($match['interests'] ?? '[]', true);
            $match['languages_spoken'] = json_decode($match['languages_spoken'] ?? '[]', true);
            
            // Only include matches with score > 30%
            if ($match['compatibility_score'] >= 30) {
                $matchesWithScores[] = $match;
            }
        }
        
        // Sort by compatibility score
        usort($matchesWithScores, function($a, $b) {
            return $b['compatibility_score'] - $a['compatibility_score'];
        });
        
        sendJsonResponse([
            'success' => true,
            'matches' => $matchesWithScores,
            'total' => count($matchesWithScores)
        ]);
        
    } catch (Exception $e) {
        logError("Find matches failed", ['user_id' => $userId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to find matches'], 500);
    }
}

function handleRecentMatches() {
    global $db;
    
    $userId = requireAuth();
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 6;
    
    try {
        $matches = $db->fetchAll("
            SELECT u.id, u.name, u.age, u.gender, u.bio, u.profile_photo, 
                   u.location, m.compatibility_score, m.match_factors, m.created_at as match_date,
                   p.interests
            FROM matches m
            JOIN users u ON (CASE WHEN m.user1_id = ? THEN m.user2_id ELSE m.user1_id END) = u.id
            LEFT JOIN preferences p ON u.id = p.user_id
            WHERE (m.user1_id = ? OR m.user2_id = ?) 
            AND m.status IN ('pending', 'mutual')
            AND u.status = 'active'
            ORDER BY m.created_at DESC
            LIMIT ?
        ", [$userId, $userId, $userId, $limit]);
        
        // Parse JSON fields
        foreach ($matches as &$match) {
            $match['interests'] = json_decode($match['interests'] ?? '[]', true);
            $match['match_factors'] = json_decode($match['match_factors'] ?? '{}', true);
        }
        
        sendJsonResponse([
            'success' => true,
            'matches' => $matches
        ]);
        
    } catch (Exception $e) {
        logError("Recent matches failed", ['user_id' => $userId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to fetch recent matches'], 500);
    }
}

function handleCalculateCompatibility() {
    global $db;
    
    $userId = requireAuth();
    $targetUserId = isset($_GET['target_user']) ? (int)$_GET['target_user'] : null;
    
    if (!$targetUserId) {
        sendJsonResponse(['error' => 'Target user ID required'], 400);
    }
    
    try {
        // Get both users' preferences
        $userPrefs = $db->fetch("
            SELECT p.*, u.location as user_location
            FROM preferences p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = ?
        ", [$userId]);
        
        $targetUserPrefs = $db->fetch("
            SELECT p.*, u.location as user_location, u.name, u.age, u.gender, u.bio, u.profile_photo
            FROM preferences p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = ? AND u.status = 'active'
        ", [$targetUserId]);
        
        if (!$userPrefs || !$targetUserPrefs) {
            sendJsonResponse(['error' => 'User preferences not found'], 404);
        }
        
        $compatibilityData = calculateCompatibilityScore($userPrefs, $targetUserPrefs);
        
        sendJsonResponse([
            'success' => true,
            'compatibility_score' => $compatibilityData['score'],
            'match_factors' => $compatibilityData['factors']
        ]);
        
    } catch (Exception $e) {
        logError("Calculate compatibility failed", ['user_id' => $userId, 'target_user' => $targetUserId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to calculate compatibility'], 500);
    }
}

function handleLikeUser() {
    global $db;
    
    $userId = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);
    $targetUserId = $input['target_user_id'] ?? null;
    
    if (!$targetUserId) {
        sendJsonResponse(['error' => 'Target user ID required'], 400);
    }
    
    try {
        $db->getConnection()->beginTransaction();
        
        // Check if match already exists
        $existingMatch = $db->fetch("
            SELECT * FROM matches 
            WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
        ", [$userId, $targetUserId, $targetUserId, $userId]);
        
        if ($existingMatch) {
            // Update existing match to mutual if other user already liked
            if ($existingMatch['status'] === 'pending') {
                $db->query("UPDATE matches SET status = 'mutual', updated_at = NOW() WHERE id = ?", [$existingMatch['id']]);
                
                // Create notifications for both users
                createMatchNotification($userId, $targetUserId);
                createMatchNotification($targetUserId, $userId);
                
                $db->getConnection()->commit();
                sendJsonResponse([
                    'success' => true,
                    'message' => 'It\'s a match!',
                    'is_mutual' => true
                ]);
            } else {
                $db->getConnection()->rollBack();
                sendJsonResponse(['error' => 'Match already processed'], 400);
            }
        } else {
            // Calculate compatibility and create new match
            $userPrefs = $db->fetch("
                SELECT p.*, u.location as user_location
                FROM preferences p
                JOIN users u ON p.user_id = u.id
                WHERE p.user_id = ?
            ", [$userId]);
            
            $targetUserPrefs = $db->fetch("
                SELECT p.*, u.location as user_location
                FROM preferences p
                JOIN users u ON p.user_id = u.id
                WHERE p.user_id = ?
            ", [$targetUserId]);
            
            $compatibilityData = calculateCompatibilityScore($userPrefs, $targetUserPrefs);
            
            // Create match record
            $db->query("
                INSERT INTO matches (user1_id, user2_id, compatibility_score, match_factors, status, created_at)
                VALUES (?, ?, ?, ?, 'pending', NOW())
            ", [$userId, $targetUserId, $compatibilityData['score'], json_encode($compatibilityData['factors'])]);
            
            $db->getConnection()->commit();
            sendJsonResponse([
                'success' => true,
                'message' => 'Like sent successfully',
                'is_mutual' => false
            ]);
        }
        
    } catch (Exception $e) {
        $db->getConnection()->rollBack();
        logError("Like user failed", ['user_id' => $userId, 'target_user' => $targetUserId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to like user'], 500);
    }
}

function handlePassUser() {
    global $db;
    
    $userId = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);
    $targetUserId = $input['target_user_id'] ?? null;
    
    if (!$targetUserId) {
        sendJsonResponse(['error' => 'Target user ID required'], 400);
    }
    
    try {
        // Create a declined match record to prevent showing this user again
        $existingMatch = $db->fetch("
            SELECT * FROM matches 
            WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)
        ", [$userId, $targetUserId, $targetUserId, $userId]);
        
        if (!$existingMatch) {
            $db->query("
                INSERT INTO matches (user1_id, user2_id, compatibility_score, status, created_at)
                VALUES (?, ?, 0, 'declined', NOW())
            ", [$userId, $targetUserId]);
        } else {
            $db->query("UPDATE matches SET status = 'declined', updated_at = NOW() WHERE id = ?", [$existingMatch['id']]);
        }
        
        sendJsonResponse([
            'success' => true,
            'message' => 'User passed'
        ]);
        
    } catch (Exception $e) {
        logError("Pass user failed", ['user_id' => $userId, 'target_user' => $targetUserId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to pass user'], 500);
    }
}

function calculateCompatibilityScore($user1Prefs, $user2Prefs) {
    $score = 0;
    $factors = [];
    $maxScore = 100;
    
    // Parse JSON fields
    $user1Interests = json_decode($user1Prefs['interests'] ?? '[]', true);
    $user2Interests = json_decode($user2Prefs['interests'] ?? '[]', true);
    $user1Destinations = json_decode($user1Prefs['preferred_destinations'] ?? '[]', true);
    $user2Destinations = json_decode($user2Prefs['preferred_destinations'] ?? '[]', true);
    $user1Languages = json_decode($user1Prefs['languages_spoken'] ?? '[]', true);
    $user2Languages = json_decode($user2Prefs['languages_spoken'] ?? '[]', true);
    
    // 1. Common Interests (25 points)
    $commonInterests = array_intersect($user1Interests, $user2Interests);
    $interestScore = 0;
    if (!empty($user1Interests) && !empty($user2Interests)) {
        $interestScore = (count($commonInterests) / max(count($user1Interests), count($user2Interests))) * 25;
    }
    $score += $interestScore;
    $factors['common_interests'] = [
        'score' => round($interestScore, 1),
        'interests' => $commonInterests
    ];
    
    // 2. Destination Overlap (20 points)
    $commonDestinations = array_intersect($user1Destinations, $user2Destinations);
    $destinationScore = 0;
    if (!empty($user1Destinations) && !empty($user2Destinations)) {
        $destinationScore = (count($commonDestinations) / max(count($user1Destinations), count($user2Destinations))) * 20;
    }
    $score += $destinationScore;
    $factors['common_destinations'] = [
        'score' => round($destinationScore, 1),
        'destinations' => $commonDestinations
    ];
    
    // 3. Travel Style Compatibility (15 points)
    $travelStyleScore = 0;
    if ($user1Prefs['travel_style'] === $user2Prefs['travel_style']) {
        $travelStyleScore = 15;
    } else {
        // Partial compatibility for similar styles
        $styleCompatibility = [
            'budget' => ['backpacking'],
            'mid-range' => ['comfort'],
            'luxury' => ['comfort'],
            'backpacking' => ['budget'],
            'comfort' => ['mid-range', 'luxury']
        ];
        
        if (isset($styleCompatibility[$user1Prefs['travel_style']]) && 
            in_array($user2Prefs['travel_style'], $styleCompatibility[$user1Prefs['travel_style']])) {
            $travelStyleScore = 7.5;
        }
    }
    $score += $travelStyleScore;
    $factors['travel_style'] = [
        'score' => $travelStyleScore,
        'user1_style' => $user1Prefs['travel_style'],
        'user2_style' => $user2Prefs['travel_style']
    ];
    
    // 4. Budget Compatibility (15 points)
    $budgetScore = 0;
    $user1BudgetMin = (float)($user1Prefs['budget_min'] ?? 0);
    $user1BudgetMax = (float)($user1Prefs['budget_max'] ?? 0);
    $user2BudgetMin = (float)($user2Prefs['budget_min'] ?? 0);
    $user2BudgetMax = (float)($user2Prefs['budget_max'] ?? 0);
    
    if ($user1BudgetMax > 0 && $user2BudgetMax > 0) {
        // Calculate overlap percentage
        $overlapMin = max($user1BudgetMin, $user2BudgetMin);
        $overlapMax = min($user1BudgetMax, $user2BudgetMax);
        
        if ($overlapMax >= $overlapMin) {
            $overlapRange = $overlapMax - $overlapMin;
            $totalRange = max($user1BudgetMax - $user1BudgetMin, $user2BudgetMax - $user2BudgetMin);
            $budgetScore = ($overlapRange / $totalRange) * 15;
        }
    }
    $score += $budgetScore;
    $factors['budget_compatibility'] = [
        'score' => round($budgetScore, 1),
        'overlap_range' => [$overlapMin ?? 0, $overlapMax ?? 0]
    ];
    
    // 5. Group Size Preference (10 points)
    $groupSizeScore = 0;
    $user1GroupSize = (int)($user1Prefs['group_size_preference'] ?? 2);
    $user2GroupSize = (int)($user2Prefs['group_size_preference'] ?? 2);
    
    if ($user1GroupSize === $user2GroupSize) {
        $groupSizeScore = 10;
    } else if (abs($user1GroupSize - $user2GroupSize) <= 1) {
        $groupSizeScore = 5;
    }
    $score += $groupSizeScore;
    $factors['group_size'] = [
        'score' => $groupSizeScore,
        'user1_preference' => $user1GroupSize,
        'user2_preference' => $user2GroupSize
    ];
    
    // 6. Language Compatibility (10 points)
    $languageScore = 0;
    $commonLanguages = array_intersect($user1Languages, $user2Languages);
    if (!empty($commonLanguages)) {
        $languageScore = min(count($commonLanguages) * 3, 10);
    }
    $score += $languageScore;
    $factors['common_languages'] = [
        'score' => $languageScore,
        'languages' => $commonLanguages
    ];
    
    // 7. Date Overlap (5 points)
    $dateScore = 0;
    if ($user1Prefs['travel_dates_start'] && $user1Prefs['travel_dates_end'] &&
        $user2Prefs['travel_dates_start'] && $user2Prefs['travel_dates_end']) {
        
        $user1Start = strtotime($user1Prefs['travel_dates_start']);
        $user1End = strtotime($user1Prefs['travel_dates_end']);
        $user2Start = strtotime($user2Prefs['travel_dates_start']);
        $user2End = strtotime($user2Prefs['travel_dates_end']);
        
        // Check for date overlap
        if ($user1Start <= $user2End && $user2Start <= $user1End) {
            $dateScore = 5;
        }
    }
    $score += $dateScore;
    $factors['date_compatibility'] = [
        'score' => $dateScore,
        'has_overlap' => $dateScore > 0
    ];
    
    return [
        'score' => round(min($score, $maxScore), 1),
        'factors' => $factors
    ];
}

function createMatchNotification($userId, $matchedUserId) {
    global $db;
    
    // Get matched user's name
    $matchedUser = $db->fetch("SELECT name FROM users WHERE id = ?", [$matchedUserId]);
    
    $db->query("
        INSERT INTO notifications (user_id, type, title, content, related_id, created_at)
        VALUES (?, 'match', 'New Match!', ?, ?, NOW())
    ", [
        $userId,
        "You have a new match with {$matchedUser['name']}! Start a conversation now.",
        $matchedUserId
    ]);
}
?>
