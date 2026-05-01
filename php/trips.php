<?php
require_once 'config.php';
require_once 'auth.php';

setCorsHeaders();

// Get the action from query parameter or request method
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

switch ($action) {
    case 'upcoming':
        handleUpcomingTrips();
        break;
    case 'create':
        handleCreateTrip();
        break;
    case 'get':
        handleGetTrip();
        break;
    case 'join':
        handleJoinTrip();
        break;
    case 'leave':
        handleLeaveTrip();
        break;
    case 'update':
        handleUpdateTrip();
        break;
    case 'search':
        handleSearchTrips();
        break;
    case 'my_trips':
        handleMyTrips();
        break;
    default:
        if ($method === 'POST') {
            handleCreateTrip();
        } else {
            sendJsonResponse(['error' => 'Invalid action'], 400);
        }
}

function handleUpcomingTrips() {
    global $db;
    
    $userId = requireAuth();
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 5;
    
    try {
        $trips = $db->fetchAll("
            SELECT t.id, t.title, t.description, t.destination, t.start_date, t.end_date,
                   t.budget_per_person, t.max_participants, t.current_participants,
                   t.trip_type, t.status, t.created_at,
                   u.name as creator_name, u.profile_photo as creator_photo
            FROM trips t
            JOIN users u ON t.creator_id = u.id
            JOIN trip_participants tp ON t.id = tp.trip_id
            WHERE tp.user_id = ? 
            AND tp.status = 'accepted'
            AND t.start_date >= CURDATE()
            AND t.status IN ('planning', 'open')
            ORDER BY t.start_date ASC
            LIMIT ?
        ", [$userId, $limit]);
        
        sendJsonResponse([
            'success' => true,
            'trips' => $trips
        ]);
        
    } catch (Exception $e) {
        logError("Upcoming trips failed", ['user_id' => $userId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to fetch upcoming trips'], 500);
    }
}

function handleMyTrips() {
    global $db;
    
    $userId = requireAuth();
    
    try {
        // Get trips created by user
        $createdTrips = $db->fetchAll("
            SELECT t.*, 'creator' as role
            FROM trips t
            WHERE t.creator_id = ?
            ORDER BY t.created_at DESC
        ", [$userId]);
        
        // Get trips user is participating in
        $participatingTrips = $db->fetchAll("
            SELECT t.*, tp.status as participation_status, 'participant' as role,
                   u.name as creator_name, u.profile_photo as creator_photo
            FROM trips t
            JOIN trip_participants tp ON t.id = tp.trip_id
            JOIN users u ON t.creator_id = u.id
            WHERE tp.user_id = ? AND t.creator_id != ?
            ORDER BY t.created_at DESC
        ", [$userId, $userId]);
        
        $allTrips = array_merge($createdTrips, $participatingTrips);
        
        // Sort by creation date
        usort($allTrips, function($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });
        
        sendJsonResponse([
            'success' => true,
            'trips' => $allTrips
        ]);
        
    } catch (Exception $e) {
        logError("My trips failed", ['user_id' => $userId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to fetch trips'], 500);
    }
}

function handleCreateTrip() {
    global $db;
    
    $userId = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    $requiredFields = ['title', 'destination', 'start_date', 'end_date'];
    foreach ($requiredFields as $field) {
        if (!isset($input[$field]) || empty(trim($input[$field]))) {
            sendJsonResponse(['error' => "Field '$field' is required"], 400);
        }
    }
    
    $title = sanitizeInput($input['title']);
    $description = sanitizeInput($input['description'] ?? '');
    $destination = sanitizeInput($input['destination']);
    $startDate = $input['start_date'];
    $endDate = $input['end_date'];
    $budgetPerPerson = isset($input['budget_per_person']) ? (float)$input['budget_per_person'] : null;
    $maxParticipants = isset($input['max_participants']) ? (int)$input['max_participants'] : 4;
    $tripType = $input['trip_type'] ?? 'other';
    $difficultyLevel = $input['difficulty_level'] ?? 'moderate';
    $itinerary = isset($input['itinerary']) ? json_encode($input['itinerary']) : null;
    $requirements = sanitizeInput($input['requirements'] ?? '');
    
    // Validate dates
    if (strtotime($startDate) < time()) {
        sendJsonResponse(['error' => 'Start date must be in the future'], 400);
    }
    
    if (strtotime($endDate) <= strtotime($startDate)) {
        sendJsonResponse(['error' => 'End date must be after start date'], 400);
    }
    
    try {
        $db->getConnection()->beginTransaction();
        
        // Create trip
        $db->query("
            INSERT INTO trips (creator_id, title, description, destination, start_date, end_date,
                             budget_per_person, max_participants, trip_type, difficulty_level,
                             itinerary, requirements, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'planning', NOW())
        ", [$userId, $title, $description, $destination, $startDate, $endDate,
            $budgetPerPerson, $maxParticipants, $tripType, $difficultyLevel,
            $itinerary, $requirements]);
        
        $tripId = $db->lastInsertId();
        
        // Add creator as first participant
        $db->query("
            INSERT INTO trip_participants (trip_id, user_id, status, joined_at)
            VALUES (?, ?, 'accepted', NOW())
        ", [$tripId, $userId]);
        
        $db->getConnection()->commit();
        
        // Get created trip data
        $trip = $db->fetch("
            SELECT t.*, u.name as creator_name, u.profile_photo as creator_photo
            FROM trips t
            JOIN users u ON t.creator_id = u.id
            WHERE t.id = ?
        ", [$tripId]);
        
        sendJsonResponse([
            'success' => true,
            'message' => 'Trip created successfully',
            'trip' => $trip
        ]);
        
    } catch (Exception $e) {
        $db->getConnection()->rollBack();
        logError("Create trip failed", ['user_id' => $userId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to create trip'], 500);
    }
}

function handleGetTrip() {
    global $db;
    
    $userId = requireAuth();
    $tripId = isset($_GET['id']) ? (int)$_GET['id'] : null;
    
    if (!$tripId) {
        sendJsonResponse(['error' => 'Trip ID required'], 400);
    }
    
    try {
        // Get trip details
        $trip = $db->fetch("
            SELECT t.*, u.name as creator_name, u.profile_photo as creator_photo,
                   u.location as creator_location
            FROM trips t
            JOIN users u ON t.creator_id = u.id
            WHERE t.id = ?
        ", [$tripId]);
        
        if (!$trip) {
            sendJsonResponse(['error' => 'Trip not found'], 404);
        }
        
        // Parse JSON fields
        $trip['itinerary'] = json_decode($trip['itinerary'] ?? '{}', true);
        
        // Get participants
        $participants = $db->fetchAll("
            SELECT tp.status, tp.joined_at, tp.message,
                   u.id, u.name, u.profile_photo, u.location, u.age
            FROM trip_participants tp
            JOIN users u ON tp.user_id = u.id
            WHERE tp.trip_id = ?
            ORDER BY tp.joined_at ASC
        ", [$tripId]);
        
        $trip['participants'] = $participants;
        
        // Check if current user is participant
        $userParticipation = $db->fetch("
            SELECT status FROM trip_participants 
            WHERE trip_id = ? AND user_id = ?
        ", [$tripId, $userId]);
        
        $trip['user_participation_status'] = $userParticipation['status'] ?? null;
        $trip['is_creator'] = $trip['creator_id'] == $userId;
        
        sendJsonResponse([
            'success' => true,
            'trip' => $trip
        ]);
        
    } catch (Exception $e) {
        logError("Get trip failed", ['user_id' => $userId, 'trip_id' => $tripId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to fetch trip'], 500);
    }
}

function handleJoinTrip() {
    global $db;
    
    $userId = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);
    
    $tripId = $input['trip_id'] ?? null;
    $message = sanitizeInput($input['message'] ?? '');
    
    if (!$tripId) {
        sendJsonResponse(['error' => 'Trip ID required'], 400);
    }
    
    try {
        $db->getConnection()->beginTransaction();
        
        // Check if trip exists and is open
        $trip = $db->fetch("
            SELECT id, creator_id, title, max_participants, current_participants, status
            FROM trips 
            WHERE id = ? AND status IN ('planning', 'open')
        ", [$tripId]);
        
        if (!$trip) {
            sendJsonResponse(['error' => 'Trip not found or not available'], 404);
        }
        
        // Check if user is already a participant
        $existingParticipation = $db->fetch("
            SELECT status FROM trip_participants 
            WHERE trip_id = ? AND user_id = ?
        ", [$tripId, $userId]);
        
        if ($existingParticipation) {
            sendJsonResponse(['error' => 'Already requested or participating in this trip'], 400);
        }
        
        // Check if trip is full
        if ($trip['current_participants'] >= $trip['max_participants']) {
            sendJsonResponse(['error' => 'Trip is full'], 400);
        }
        
        // Add participation request
        $db->query("
            INSERT INTO trip_participants (trip_id, user_id, status, message, joined_at)
            VALUES (?, ?, 'requested', ?, NOW())
        ", [$tripId, $userId, $message]);
        
        // Notify trip creator
        $user = $db->fetch("SELECT name FROM users WHERE id = ?", [$userId]);
        $db->query("
            INSERT INTO notifications (user_id, type, title, content, related_id, created_at)
            VALUES (?, 'trip_request', 'New Trip Request', ?, ?, NOW())
        ", [$trip['creator_id'], "{$user['name']} wants to join your trip '{$trip['title']}'", $tripId]);
        
        $db->getConnection()->commit();
        
        sendJsonResponse([
            'success' => true,
            'message' => 'Trip join request sent successfully'
        ]);
        
    } catch (Exception $e) {
        $db->getConnection()->rollBack();
        logError("Join trip failed", ['user_id' => $userId, 'trip_id' => $tripId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to join trip'], 500);
    }
}

function handleLeaveTrip() {
    global $db;
    
    $userId = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);
    
    $tripId = $input['trip_id'] ?? null;
    
    if (!$tripId) {
        sendJsonResponse(['error' => 'Trip ID required'], 400);
    }
    
    try {
        $db->getConnection()->beginTransaction();
        
        // Check if user is participant
        $participation = $db->fetch("
            SELECT status FROM trip_participants 
            WHERE trip_id = ? AND user_id = ?
        ", [$tripId, $userId]);
        
        if (!$participation) {
            sendJsonResponse(['error' => 'Not a participant of this trip'], 400);
        }
        
        // Update participation status
        $db->query("
            UPDATE trip_participants 
            SET status = 'left' 
            WHERE trip_id = ? AND user_id = ?
        ", [$tripId, $userId]);
        
        // Update trip participant count
        $db->query("
            UPDATE trips 
            SET current_participants = current_participants - 1 
            WHERE id = ? AND current_participants > 1
        ", [$tripId]);
        
        $db->getConnection()->commit();
        
        sendJsonResponse([
            'success' => true,
            'message' => 'Left trip successfully'
        ]);
        
    } catch (Exception $e) {
        $db->getConnection()->rollBack();
        logError("Leave trip failed", ['user_id' => $userId, 'trip_id' => $tripId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to leave trip'], 500);
    }
}

function handleSearchTrips() {
    global $db;
    
    $userId = requireAuth();
    
    $destination = $_GET['destination'] ?? '';
    $startDate = $_GET['start_date'] ?? '';
    $endDate = $_GET['end_date'] ?? '';
    $tripType = $_GET['trip_type'] ?? '';
    $maxBudget = isset($_GET['max_budget']) ? (float)$_GET['max_budget'] : null;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    
    try {
        $whereConditions = ["t.status IN ('planning', 'open')", "t.creator_id != ?"];
        $params = [$userId];
        
        if ($destination) {
            $whereConditions[] = "t.destination LIKE ?";
            $params[] = "%$destination%";
        }
        
        if ($startDate) {
            $whereConditions[] = "t.start_date >= ?";
            $params[] = $startDate;
        }
        
        if ($endDate) {
            $whereConditions[] = "t.end_date <= ?";
            $params[] = $endDate;
        }
        
        if ($tripType) {
            $whereConditions[] = "t.trip_type = ?";
            $params[] = $tripType;
        }
        
        if ($maxBudget) {
            $whereConditions[] = "(t.budget_per_person IS NULL OR t.budget_per_person <= ?)";
            $params[] = $maxBudget;
        }
        
        // Exclude trips user has already interacted with
        $whereConditions[] = "t.id NOT IN (
            SELECT trip_id FROM trip_participants 
            WHERE user_id = ? AND status IN ('requested', 'accepted', 'declined')
        )";
        $params[] = $userId;
        
        $params[] = $limit;
        $params[] = $offset;
        
        $sql = "
            SELECT t.id, t.title, t.description, t.destination, t.start_date, t.end_date,
                   t.budget_per_person, t.max_participants, t.current_participants,
                   t.trip_type, t.difficulty_level, t.status, t.created_at,
                   u.name as creator_name, u.profile_photo as creator_photo,
                   u.location as creator_location
            FROM trips t
            JOIN users u ON t.creator_id = u.id
            WHERE " . implode(' AND ', $whereConditions) . "
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
        ";
        
        $trips = $db->fetchAll($sql, $params);
        
        sendJsonResponse([
            'success' => true,
            'trips' => $trips,
            'total' => count($trips)
        ]);
        
    } catch (Exception $e) {
        logError("Search trips failed", ['user_id' => $userId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to search trips'], 500);
    }
}

function handleUpdateTrip() {
    global $db;
    
    $userId = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);
    
    $tripId = $input['trip_id'] ?? null;
    
    if (!$tripId) {
        sendJsonResponse(['error' => 'Trip ID required'], 400);
    }
    
    try {
        // Check if user is the creator
        $trip = $db->fetch("SELECT creator_id FROM trips WHERE id = ?", [$tripId]);
        
        if (!$trip || $trip['creator_id'] != $userId) {
            sendJsonResponse(['error' => 'Not authorized to update this trip'], 403);
        }
        
        // Build update query
        $updateFields = [];
        $params = [];
        
        $allowedFields = ['title', 'description', 'destination', 'start_date', 'end_date',
                         'budget_per_person', 'max_participants', 'trip_type', 'difficulty_level',
                         'requirements', 'status'];
        
        foreach ($allowedFields as $field) {
            if (isset($input[$field])) {
                $updateFields[] = "$field = ?";
                $params[] = $input[$field];
            }
        }
        
        if (isset($input['itinerary'])) {
            $updateFields[] = "itinerary = ?";
            $params[] = json_encode($input['itinerary']);
        }
        
        if (!empty($updateFields)) {
            $updateFields[] = "updated_at = NOW()";
            $params[] = $tripId;
            
            $sql = "UPDATE trips SET " . implode(', ', $updateFields) . " WHERE id = ?";
            $db->query($sql, $params);
        }
        
        sendJsonResponse([
            'success' => true,
            'message' => 'Trip updated successfully'
        ]);
        
    } catch (Exception $e) {
        logError("Update trip failed", ['user_id' => $userId, 'trip_id' => $tripId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to update trip'], 500);
    }
}
?>
