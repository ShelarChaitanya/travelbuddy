<?php
require_once 'config.php';

setCorsHeaders();

// Get JSON input
$input = json_decode(file_get_contents('php://input'), true);

if (!$input || !isset($input['action'])) {
    sendJsonResponse(['error' => 'Invalid request'], 400);
}

$action = $input['action'];

switch ($action) {
    case 'signup':
        handleSignup($input);
        break;
    case 'login':
        handleLogin($input);
        break;
    case 'logout':
        handleLogout();
        break;
    case 'verify-email':
        handleEmailVerification($input);
        break;
    default:
        sendJsonResponse(['error' => 'Invalid action'], 400);
}

function handleSignup($input) {
    global $db;
    
    // Validate required fields
    $requiredFields = ['name', 'email', 'password'];
    foreach ($requiredFields as $field) {
        if (!isset($input[$field]) || empty(trim($input[$field]))) {
            sendJsonResponse(['error' => "Field '$field' is required"], 400);
        }
    }
    
    $name = sanitizeInput($input['name']);
    $email = sanitizeInput($input['email']);
    $password = $input['password'];
    
    // Validate email format
    if (!validateEmail($email)) {
        sendJsonResponse(['error' => 'Invalid email format'], 400);
    }
    
    // Validate password strength
    if (strlen($password) < 6) {
        sendJsonResponse(['error' => 'Password must be at least 6 characters long'], 400);
    }
    
    // Check if email already exists
    $existingUser = $db->fetch("SELECT id FROM users WHERE email = ?", [$email]);
    if ($existingUser) {
        sendJsonResponse(['error' => 'Email already registered'], 400);
    }
    
    try {
        // Hash password
        $passwordHash = hashPassword($password);
        $verificationToken = generateToken();
        
        // Insert new user
        $sql = "INSERT INTO users (name, email, password_hash, verification_token, created_at) VALUES (?, ?, ?, ?, NOW())";
        $db->query($sql, [$name, $email, $passwordHash, $verificationToken]);
        
        $userId = $db->lastInsertId();
        
        // Create default preferences
        $defaultPreferences = "INSERT INTO preferences (user_id, created_at) VALUES (?, NOW())";
        $db->query($defaultPreferences, [$userId]);
        
        // Get user data (without password)
        $user = $db->fetch("SELECT id, name, email, is_verified, created_at FROM users WHERE id = ?", [$userId]);
        
        // TODO: Send verification email (implement email service)
        
        sendJsonResponse([
            'success' => true,
            'message' => 'Account created successfully',
            'user' => $user
        ]);
        
    } catch (Exception $e) {
        logError("Signup failed", ['email' => $email, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Registration failed. Please try again.'], 500);
    }
}

function handleLogin($input) {
    global $db;
    
    // Validate required fields
    if (!isset($input['email']) || !isset($input['password'])) {
        sendJsonResponse(['error' => 'Email and password are required'], 400);
    }
    
    $email = sanitizeInput($input['email']);
    $password = $input['password'];
    
    // Validate email format
    if (!validateEmail($email)) {
        sendJsonResponse(['error' => 'Invalid email format'], 400);
    }
    
    try {
        // Get user from database
        $user = $db->fetch("SELECT id, name, email, password_hash, is_verified, status FROM users WHERE email = ?", [$email]);
        
        if (!$user) {
            sendJsonResponse(['error' => 'Invalid email or password'], 401);
        }
        
        // Check if account is active
        if ($user['status'] !== 'active') {
            sendJsonResponse(['error' => 'Account is suspended or inactive'], 401);
        }
        
        // Verify password
        if (!verifyPassword($password, $user['password_hash'])) {
            sendJsonResponse(['error' => 'Invalid email or password'], 401);
        }
        
        // Update last login
        $db->query("UPDATE users SET last_login = NOW() WHERE id = ?", [$user['id']]);
        
        // Remove password hash from response
        unset($user['password_hash']);
        
        // Start session
        session_start();
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['user_email'] = $user['email'];
        
        sendJsonResponse([
            'success' => true,
            'message' => 'Login successful',
            'user' => $user
        ]);
        
    } catch (Exception $e) {
        logError("Login failed", ['email' => $email, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Login failed. Please try again.'], 500);
    }
}

function handleLogout() {
    session_start();
    session_destroy();
    
    sendJsonResponse([
        'success' => true,
        'message' => 'Logged out successfully'
    ]);
}

function handleEmailVerification($input) {
    global $db;
    
    if (!isset($input['token'])) {
        sendJsonResponse(['error' => 'Verification token is required'], 400);
    }
    
    $token = sanitizeInput($input['token']);
    
    try {
        // Find user with verification token
        $user = $db->fetch("SELECT id, email FROM users WHERE verification_token = ? AND is_verified = 0", [$token]);
        
        if (!$user) {
            sendJsonResponse(['error' => 'Invalid or expired verification token'], 400);
        }
        
        // Update user as verified
        $db->query("UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?", [$user['id']]);
        
        sendJsonResponse([
            'success' => true,
            'message' => 'Email verified successfully'
        ]);
        
    } catch (Exception $e) {
        logError("Email verification failed", ['token' => $token, 'error' => $e->getMessage()]);
        sendJsonResponse(['error' => 'Verification failed. Please try again.'], 500);
    }
}

// Helper function to check if user is authenticated
function requireAuth() {
    session_start();
    if (!isset($_SESSION['user_id'])) {
        sendJsonResponse(['error' => 'Authentication required'], 401);
    }
    return $_SESSION['user_id'];
}

// Helper function to get current user
function getCurrentUser() {
    global $db;
    $userId = requireAuth();
    
    $user = $db->fetch("SELECT id, name, email, is_verified, status FROM users WHERE id = ?", [$userId]);
    
    if (!$user || $user['status'] !== 'active') {
        sendJsonResponse(['error' => 'User not found or inactive'], 401);
    }
    
    return $user;
}
?>
