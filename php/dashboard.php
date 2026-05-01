<?php
require_once 'config.php';
require_once 'auth.php';

setCorsHeaders();

// Get the action from query parameter
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'stats':
        handleDashboardStats();
        break;
    default:
        sendJsonResponse(['error' => 'Invalid action'], 400);
}

function handleDashboardStats() {
    global $db;
    
    $userId = requireAuth();
    
    try {
        // Get new matches count (pending matches where user hasn't been notified)
        $matchCount = $db->fetch("
            SELECT COUNT(*) as count
            FROM matches m
            WHERE (m.user1_id = ? OR m.user2_id = ?) 
            AND m.status IN ('pending', 'mutual')
            AND m.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ", [$userId, $userId]);
        
        // Get unread messages count
        $messageCount = $db->fetch("
            SELECT COUNT(*) as count
            FROM messages
            WHERE receiver_id = ? AND is_read = 0
        ", [$userId]);
        
        // Get active trips count (trips user is participating in that are not completed)
        $tripCount = $db->fetch("
            SELECT COUNT(*) as count
            FROM trip_participants tp
            JOIN trips t ON tp.trip_id = t.id
            WHERE tp.user_id = ? 
            AND tp.status = 'accepted'
            AND t.status IN ('planning', 'open')
        ", [$userId]);
        
        sendJsonResponse([
            'success' => true,
            'stats' => [
                'matchCount' => (int)$matchCount['count'],
                'messageCount' => (int)$messageCount['count'],
                'tripCount' => (int)$tripCount['count']
            ]
        ]);
        
    } catch (Exception $e) {
        logError("Dashboard stats failed", ['user_id' => $userId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to fetch dashboard stats'], 500);
    }
}
?>
