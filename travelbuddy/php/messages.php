<?php
require_once 'config.php';
require_once 'auth.php';

setCorsHeaders();

// Get the action from query parameter or request method
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

switch ($action) {
    case 'recent':
        handleRecentMessages();
        break;
    case 'conversation':
        handleGetConversation();
        break;
    case 'send':
        handleSendMessage();
        break;
    case 'mark_read':
        handleMarkAsRead();
        break;
    case 'conversations':
        handleGetConversations();
        break;
    default:
        if ($method === 'POST') {
            handleSendMessage();
        } else {
            sendJsonResponse(['error' => 'Invalid action'], 400);
        }
}

function handleRecentMessages() {
    global $db;
    
    $userId = requireAuth();
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 5;
    
    try {
        $messages = $db->fetchAll("
            SELECT DISTINCT
                m.id,
                m.sender_id,
                m.receiver_id,
                m.message,
                m.is_read,
                m.created_at,
                CASE 
                    WHEN m.sender_id = ? THEN ru.name 
                    ELSE su.name 
                END as other_user_name,
                CASE 
                    WHEN m.sender_id = ? THEN ru.profile_photo 
                    ELSE su.profile_photo 
                END as other_user_photo,
                CASE 
                    WHEN m.sender_id = ? THEN m.receiver_id 
                    ELSE m.sender_id 
                END as other_user_id
            FROM messages m
            JOIN users su ON m.sender_id = su.id
            JOIN users ru ON m.receiver_id = ru.id
            WHERE (m.sender_id = ? OR m.receiver_id = ?)
            AND m.id IN (
                SELECT MAX(id) 
                FROM messages 
                WHERE (sender_id = ? AND receiver_id IN (
                    SELECT DISTINCT CASE 
                        WHEN sender_id = ? THEN receiver_id 
                        ELSE sender_id 
                    END 
                    FROM messages 
                    WHERE sender_id = ? OR receiver_id = ?
                ))
                OR (receiver_id = ? AND sender_id IN (
                    SELECT DISTINCT CASE 
                        WHEN sender_id = ? THEN receiver_id 
                        ELSE sender_id 
                    END 
                    FROM messages 
                    WHERE sender_id = ? OR receiver_id = ?
                ))
                GROUP BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)
            )
            ORDER BY m.created_at DESC
            LIMIT ?
        ", [$userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $limit]);
        
        // Add sender name for display
        foreach ($messages as &$message) {
            if ($message['sender_id'] == $userId) {
                $message['sender_name'] = 'You';
            } else {
                $senderInfo = $db->fetch("SELECT name FROM users WHERE id = ?", [$message['sender_id']]);
                $message['sender_name'] = $senderInfo['name'];
            }
        }
        
        sendJsonResponse([
            'success' => true,
            'messages' => $messages
        ]);
        
    } catch (Exception $e) {
        logError("Recent messages failed", ['user_id' => $userId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to fetch recent messages'], 500);
    }
}

function handleGetConversations() {
    global $db;
    
    $userId = requireAuth();
    
    try {
        $conversations = $db->fetchAll("
            SELECT DISTINCT
                CASE 
                    WHEN m.sender_id = ? THEN m.receiver_id 
                    ELSE m.sender_id 
                END as other_user_id,
                CASE 
                    WHEN m.sender_id = ? THEN ru.name 
                    ELSE su.name 
                END as other_user_name,
                CASE 
                    WHEN m.sender_id = ? THEN ru.profile_photo 
                    ELSE su.profile_photo 
                END as other_user_photo,
                MAX(m.created_at) as last_message_time,
                (SELECT message FROM messages 
                 WHERE (sender_id = ? AND receiver_id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END)
                    OR (receiver_id = ? AND sender_id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END)
                 ORDER BY created_at DESC LIMIT 1) as last_message,
                COUNT(CASE WHEN m.receiver_id = ? AND m.is_read = 0 THEN 1 END) as unread_count
            FROM messages m
            JOIN users su ON m.sender_id = su.id
            JOIN users ru ON m.receiver_id = ru.id
            WHERE m.sender_id = ? OR m.receiver_id = ?
            GROUP BY 
                CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END,
                CASE WHEN m.sender_id = ? THEN ru.name ELSE su.name END,
                CASE WHEN m.sender_id = ? THEN ru.profile_photo ELSE su.profile_photo END
            ORDER BY last_message_time DESC
        ", [$userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId, $userId]);
        
        sendJsonResponse([
            'success' => true,
            'conversations' => $conversations
        ]);
        
    } catch (Exception $e) {
        logError("Get conversations failed", ['user_id' => $userId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to fetch conversations'], 500);
    }
}

function handleGetConversation() {
    global $db;
    
    $userId = requireAuth();
    $otherUserId = isset($_GET['user']) ? (int)$_GET['user'] : null;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    
    if (!$otherUserId) {
        sendJsonResponse(['error' => 'User ID required'], 400);
    }
    
    try {
        // Get conversation messages
        $messages = $db->fetchAll("
            SELECT m.id, m.sender_id, m.receiver_id, m.message, m.subject, 
                   m.message_type, m.is_read, m.created_at,
                   s.name as sender_name, s.profile_photo as sender_photo
            FROM messages m
            JOIN users s ON m.sender_id = s.id
            WHERE (m.sender_id = ? AND m.receiver_id = ?) 
               OR (m.sender_id = ? AND m.receiver_id = ?)
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        ", [$userId, $otherUserId, $otherUserId, $userId, $limit, $offset]);
        
        // Get other user info
        $otherUser = $db->fetch("
            SELECT id, name, profile_photo, location, is_verified
            FROM users 
            WHERE id = ? AND status = 'active'
        ", [$otherUserId]);
        
        if (!$otherUser) {
            sendJsonResponse(['error' => 'User not found'], 404);
        }
        
        // Mark messages as read
        $db->query("
            UPDATE messages 
            SET is_read = 1 
            WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
        ", [$otherUserId, $userId]);
        
        sendJsonResponse([
            'success' => true,
            'messages' => array_reverse($messages), // Reverse to show oldest first
            'other_user' => $otherUser,
            'total' => count($messages)
        ]);
        
    } catch (Exception $e) {
        logError("Get conversation failed", ['user_id' => $userId, 'other_user' => $otherUserId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to fetch conversation'], 500);
    }
}

function handleSendMessage() {
    global $db;
    
    $userId = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);
    
    $receiverId = $input['receiver_id'] ?? null;
    $message = trim($input['message'] ?? '');
    $subject = trim($input['subject'] ?? '');
    $messageType = $input['message_type'] ?? 'direct';
    $tripId = $input['trip_id'] ?? null;
    
    if (!$receiverId || !$message) {
        sendJsonResponse(['error' => 'Receiver ID and message are required'], 400);
    }
    
    if (strlen($message) > 1000) {
        sendJsonResponse(['error' => 'Message too long (max 1000 characters)'], 400);
    }
    
    try {
        // Check if receiver exists and is active
        $receiver = $db->fetch("SELECT id, name FROM users WHERE id = ? AND status = 'active'", [$receiverId]);
        if (!$receiver) {
            sendJsonResponse(['error' => 'Recipient not found'], 404);
        }
        
        // Check if sender is blocked by receiver
        $isBlocked = $db->fetch("
            SELECT id FROM user_blocks 
            WHERE blocker_id = ? AND blocked_id = ?
        ", [$receiverId, $userId]);
        
        if ($isBlocked) {
            sendJsonResponse(['error' => 'Unable to send message'], 403);
        }
        
        // Insert message
        $db->query("
            INSERT INTO messages (sender_id, receiver_id, message, subject, message_type, trip_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ", [$userId, $receiverId, $message, $subject, $messageType, $tripId]);
        
        $messageId = $db->lastInsertId();
        
        // Create notification for receiver
        $sender = $db->fetch("SELECT name FROM users WHERE id = ?", [$userId]);
        $db->query("
            INSERT INTO notifications (user_id, type, title, content, related_id, created_at)
            VALUES (?, 'message', 'New Message', ?, ?, NOW())
        ", [$receiverId, "New message from {$sender['name']}", $messageId]);
        
        // Get the sent message with sender info
        $sentMessage = $db->fetch("
            SELECT m.id, m.sender_id, m.receiver_id, m.message, m.subject, 
                   m.message_type, m.is_read, m.created_at,
                   s.name as sender_name, s.profile_photo as sender_photo
            FROM messages m
            JOIN users s ON m.sender_id = s.id
            WHERE m.id = ?
        ", [$messageId]);
        
        sendJsonResponse([
            'success' => true,
            'message' => 'Message sent successfully',
            'sent_message' => $sentMessage
        ]);
        
    } catch (Exception $e) {
        logError("Send message failed", ['user_id' => $userId, 'receiver_id' => $receiverId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to send message'], 500);
    }
}

function handleMarkAsRead() {
    global $db;
    
    $userId = requireAuth();
    $input = json_decode(file_get_contents('php://input'), true);
    
    $messageId = $input['message_id'] ?? null;
    $otherUserId = $input['other_user_id'] ?? null;
    
    try {
        if ($messageId) {
            // Mark specific message as read
            $db->query("
                UPDATE messages 
                SET is_read = 1 
                WHERE id = ? AND receiver_id = ?
            ", [$messageId, $userId]);
        } elseif ($otherUserId) {
            // Mark all messages from specific user as read
            $db->query("
                UPDATE messages 
                SET is_read = 1 
                WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
            ", [$otherUserId, $userId]);
        } else {
            sendJsonResponse(['error' => 'Message ID or user ID required'], 400);
        }
        
        sendJsonResponse([
            'success' => true,
            'message' => 'Messages marked as read'
        ]);
        
    } catch (Exception $e) {
        logError("Mark as read failed", ['user_id' => $userId, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Failed to mark messages as read'], 500);
    }
}
?>
