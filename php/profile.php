<?php
require_once 'config.php';
require_once 'auth.php';

setCorsHeaders();

// Handle different HTTP methods
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetProfile();
        break;
    case 'POST':
        handleUpdateProfile();
        break;
    case 'PUT':
        handleUpdateProfile();
        break;
    default:
        sendJsonResponse(['error' => 'Method not allowed'], 405);
}

function handleGetProfile() {
    global $db;
    
    // Get user ID from query parameter or session
    $userId = isset($_GET['user']) ? (int)$_GET['user'] : null;
    
    if (!$userId) {
        $userId = requireAuth();
    }
    
    try {
        // Get user profile
        $user = $db->fetch("
            SELECT u.id, u.name, u.email, u.age, u.gender, u.bio, u.profile_photo, 
                   u.location, u.phone, u.is_verified, u.created_at,
                   p.preferred_destinations, p.travel_dates_start, p.travel_dates_end,
                   p.budget_min, p.budget_max, p.interests, p.travel_style,
                   p.group_size_preference, p.accommodation_type, p.transportation_mode,
                   p.languages_spoken
            FROM users u
            LEFT JOIN preferences p ON u.id = p.user_id
            WHERE u.id = ? AND u.status = 'active'
        ", [$userId]);
        
        if (!$user) {
            sendJsonResponse(['error' => 'User not found'], 404);
        }
        
        // Parse JSON fields
        $user['preferred_destinations'] = json_decode($user['preferred_destinations'] ?? '[]', true);
        $user['interests'] = json_decode($user['interests'] ?? '[]', true);
        $user['languages_spoken'] = json_decode($user['languages_spoken'] ?? '[]', true);
        
        // Get user ratings
        $ratings = $db->fetchAll("
            SELECT AVG(rating) as average_rating, COUNT(*) as total_ratings
            FROM user_ratings 
            WHERE rated_user_id = ?
        ", [$userId]);
        
        $user['average_rating'] = $ratings[0]['average_rating'] ? round($ratings[0]['average_rating'], 1) : null;
        $user['total_ratings'] = $ratings[0]['total_ratings'];
        
        // Get completed trips count
        $tripsCount = $db->fetch("
            SELECT COUNT(*) as completed_trips
            FROM trip_participants tp
            JOIN trips t ON tp.trip_id = t.id
            WHERE tp.user_id = ? AND t.status = 'completed'
        ", [$userId]);
        
        $user['completed_trips'] = $tripsCount['completed_trips'];
        
        sendJsonResponse([
            'success' => true,
            'user' => $user
        ]);
        
    } catch (Exception $e) {
        logError("Get profile failed", ['user_id' => $userId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to fetch profile'], 500);
    }
}

function handleUpdateProfile() {
    global $db;
    
    $userId = requireAuth();
    
    try {
        $db->getConnection()->beginTransaction();
        
        // Handle file upload if present
        $profilePhotoPath = null;
        if (isset($_FILES['profile_photo']) && $_FILES['profile_photo']['error'] === UPLOAD_ERR_OK) {
            $profilePhotoPath = handlePhotoUpload($_FILES['profile_photo'], $userId);
        }
        
        // Update user table
        $userFields = [];
        $userParams = [];
        
        if (isset($_POST['age'])) {
            $userFields[] = 'age = ?';
            $userParams[] = (int)$_POST['age'];
        }
        
        if (isset($_POST['gender'])) {
            $userFields[] = 'gender = ?';
            $userParams[] = $_POST['gender'];
        }
        
        if (isset($_POST['bio'])) {
            $userFields[] = 'bio = ?';
            $userParams[] = $_POST['bio'];
        }
        
        if (isset($_POST['location'])) {
            $userFields[] = 'location = ?';
            $userParams[] = $_POST['location'];
        }
        
        if (isset($_POST['phone'])) {
            $userFields[] = 'phone = ?';
            $userParams[] = $_POST['phone'];
        }
        
        if ($profilePhotoPath) {
            $userFields[] = 'profile_photo = ?';
            $userParams[] = $profilePhotoPath;
        }
        
        if (!empty($userFields)) {
            $userFields[] = 'updated_at = NOW()';
            $userParams[] = $userId;
            
            $userSql = "UPDATE users SET " . implode(', ', $userFields) . " WHERE id = ?";
            $db->query($userSql, $userParams);
        }
        
        // Update or insert preferences
        $preferencesData = [
            'travel_style' => $_POST['travel_style'] ?? null,
            'group_size_preference' => isset($_POST['group_size_preference']) ? (int)$_POST['group_size_preference'] : null,
            'budget_min' => isset($_POST['budget_min']) ? (float)$_POST['budget_min'] : null,
            'budget_max' => isset($_POST['budget_max']) ? (float)$_POST['budget_max'] : null,
            'accommodation_type' => $_POST['accommodation_type'] ?? 'any',
            'transportation_mode' => $_POST['transportation_mode'] ?? 'any',
            'interests' => isset($_POST['interests']) ? $_POST['interests'] : '[]',
            'languages_spoken' => isset($_POST['languages_spoken']) ? $_POST['languages_spoken'] : '[]',
            'preferred_destinations' => isset($_POST['preferred_destinations']) ? $_POST['preferred_destinations'] : '[]',
            'travel_dates_start' => $_POST['travel_dates_start'] ?? null,
            'travel_dates_end' => $_POST['travel_dates_end'] ?? null
        ];
        
        // Check if preferences exist
        $existingPrefs = $db->fetch("SELECT id FROM preferences WHERE user_id = ?", [$userId]);
        
        if ($existingPrefs) {
            // Update existing preferences
            $prefFields = [];
            $prefParams = [];
            
            foreach ($preferencesData as $field => $value) {
                if ($value !== null) {
                    $prefFields[] = "$field = ?";
                    $prefParams[] = $value;
                }
            }
            
            if (!empty($prefFields)) {
                $prefFields[] = 'updated_at = NOW()';
                $prefParams[] = $userId;
                
                $prefSql = "UPDATE preferences SET " . implode(', ', $prefFields) . " WHERE user_id = ?";
                $db->query($prefSql, $prefParams);
            }
        } else {
            // Insert new preferences
            $prefFields = ['user_id'];
            $prefValues = ['?'];
            $prefParams = [$userId];
            
            foreach ($preferencesData as $field => $value) {
                if ($value !== null) {
                    $prefFields[] = $field;
                    $prefValues[] = '?';
                    $prefParams[] = $value;
                }
            }
            
            $prefFields[] = 'created_at';
            $prefValues[] = 'NOW()';
            
            $prefSql = "INSERT INTO preferences (" . implode(', ', $prefFields) . ") VALUES (" . implode(', ', $prefValues) . ")";
            $db->query($prefSql, $prefParams);
        }
        
        $db->getConnection()->commit();
        
        // Get updated user data
        $updatedUser = $db->fetch("
            SELECT u.id, u.name, u.email, u.age, u.gender, u.bio, u.profile_photo, 
                   u.location, u.phone, u.is_verified
            FROM users u
            WHERE u.id = ?
        ", [$userId]);
        
        sendJsonResponse([
            'success' => true,
            'message' => 'Profile updated successfully',
            'user' => $updatedUser
        ]);
        
    } catch (Exception $e) {
        $db->getConnection()->rollBack();
        logError("Profile update failed", ['user_id' => $userId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to update profile'], 500);
    }
}

function handlePhotoUpload($file, $userId) {
    // Create uploads directory if it doesn't exist
    $uploadDir = 'uploads/profiles/';
    if (!file_exists($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    // Validate file
    $allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!in_array($file['type'], $allowedTypes)) {
        throw new Exception('Invalid file type. Only JPG, PNG, and GIF are allowed.');
    }
    
    if ($file['size'] > MAX_FILE_SIZE) {
        throw new Exception('File size too large. Maximum size is 5MB.');
    }
    
    // Generate unique filename
    $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = 'profile_' . $userId . '_' . time() . '.' . $extension;
    $filepath = $uploadDir . $filename;
    
    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $filepath)) {
        throw new Exception('Failed to upload file.');
    }
    
    // Return relative path for database storage
    return $filepath;
}

// Helper function to delete old profile photo
function deleteOldPhoto($photoPath) {
    if ($photoPath && file_exists($photoPath)) {
        unlink($photoPath);
    }
}
?>
