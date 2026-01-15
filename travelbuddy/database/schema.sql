-- Travel Together Database Schema
-- MySQL Database for Travel Buddy Finder System

CREATE DATABASE IF NOT EXISTS travel_together;
USE travel_together;

-- Users table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    age INT,
    gender ENUM('male', 'female', 'other', 'prefer_not_to_say'),
    bio TEXT,
    profile_photo VARCHAR(255),
    location VARCHAR(100),
    phone VARCHAR(20),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active'
);

-- User preferences table
CREATE TABLE preferences (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    preferred_destinations TEXT, -- JSON array of destinations
    travel_dates_start DATE,
    travel_dates_end DATE,
    budget_min DECIMAL(10,2),
    budget_max DECIMAL(10,2),
    interests TEXT, -- JSON array of interests
    travel_style ENUM('budget', 'mid-range', 'luxury', 'backpacking', 'comfort') DEFAULT 'mid-range',
    group_size_preference INT DEFAULT 2,
    accommodation_type ENUM('hotel', 'hostel', 'airbnb', 'camping', 'any') DEFAULT 'any',
    transportation_mode ENUM('flight', 'train', 'bus', 'car', 'any') DEFAULT 'any',
    languages_spoken TEXT, -- JSON array of languages
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Trips table
CREATE TABLE trips (
    id INT PRIMARY KEY AUTO_INCREMENT,
    creator_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    destination VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    budget_per_person DECIMAL(10,2),
    max_participants INT DEFAULT 4,
    current_participants INT DEFAULT 1,
    trip_type ENUM('adventure', 'relaxation', 'cultural', 'business', 'educational', 'other') DEFAULT 'other',
    difficulty_level ENUM('easy', 'moderate', 'challenging') DEFAULT 'moderate',
    itinerary TEXT, -- JSON object with daily plans
    requirements TEXT,
    status ENUM('planning', 'open', 'full', 'completed', 'cancelled') DEFAULT 'planning',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Trip participants table
CREATE TABLE trip_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    trip_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('requested', 'accepted', 'declined', 'left') DEFAULT 'requested',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    message TEXT,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_trip_user (trip_id, user_id)
);

-- Matches table (for buddy matching algorithm)
CREATE TABLE matches (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user1_id INT NOT NULL,
    user2_id INT NOT NULL,
    compatibility_score DECIMAL(5,2) NOT NULL,
    match_factors TEXT, -- JSON object explaining match factors
    status ENUM('pending', 'mutual', 'declined', 'blocked') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_match (user1_id, user2_id),
    CHECK (user1_id != user2_id)
);

-- Messages table
CREATE TABLE messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    trip_id INT NULL, -- Optional: if message is related to a specific trip
    subject VARCHAR(200),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    message_type ENUM('direct', 'trip_request', 'trip_update', 'system') DEFAULT 'direct',
    parent_message_id INT NULL, -- For threaded conversations
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_message_id) REFERENCES messages(id) ON DELETE CASCADE
);

-- User ratings table (for rating travel buddies after trips)
CREATE TABLE user_ratings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    rater_id INT NOT NULL,
    rated_user_id INT NOT NULL,
    trip_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    categories TEXT, -- JSON object with category ratings (communication, reliability, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rater_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (rated_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    UNIQUE KEY unique_rating (rater_id, rated_user_id, trip_id),
    CHECK (rater_id != rated_user_id)
);

-- User blocks table (for blocking unwanted users)
CREATE TABLE user_blocks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    blocker_id INT NOT NULL,
    blocked_id INT NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_block (blocker_id, blocked_id),
    CHECK (blocker_id != blocked_id)
);

-- Notifications table
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('match', 'message', 'trip_request', 'trip_update', 'rating', 'system') NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    related_id INT, -- ID of related entity (trip, message, user, etc.)
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Search history table (for improving recommendations)
CREATE TABLE search_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    search_query VARCHAR(500),
    filters TEXT, -- JSON object with applied filters
    results_count INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_preferences_user_id ON preferences(user_id);
CREATE INDEX idx_preferences_dates ON preferences(travel_dates_start, travel_dates_end);
CREATE INDEX idx_trips_creator ON trips(creator_id);
CREATE INDEX idx_trips_destination ON trips(destination);
CREATE INDEX idx_trips_dates ON trips(start_date, end_date);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_matches_users ON matches(user1_id, user2_id);
CREATE INDEX idx_matches_score ON matches(compatibility_score);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- Insert some sample data for testing
INSERT INTO users (name, email, password_hash, age, gender, bio, location) VALUES
('John Doe', 'john@example.com', '$2y$10$example_hash_1', 28, 'male', 'Adventure seeker and photography enthusiast. Love exploring new cultures and trying local cuisines.', 'New York, USA'),
('Sarah Johnson', 'sarah@example.com', '$2y$10$example_hash_2', 25, 'female', 'Solo traveler looking for companions to explore Europe. Interested in history and art.', 'London, UK'),
('Mike Chen', 'mike@example.com', '$2y$10$example_hash_3', 32, 'male', 'Backpacker with 10+ years experience. Always up for hiking and outdoor adventures.', 'San Francisco, USA'),
('Emma Wilson', 'emma@example.com', '$2y$10$example_hash_4', 29, 'female', 'Digital nomad seeking travel buddies for co-working and exploring. Love beaches and mountains equally.', 'Sydney, Australia');

INSERT INTO preferences (user_id, preferred_destinations, travel_dates_start, travel_dates_end, budget_min, budget_max, interests, travel_style) VALUES
(1, '["Japan", "Thailand", "Vietnam"]', '2024-06-01', '2024-06-15', 1500.00, 3000.00, '["photography", "food", "culture", "temples"]', 'mid-range'),
(2, '["Italy", "France", "Spain"]', '2024-07-10', '2024-07-25', 2000.00, 4000.00, '["art", "history", "museums", "wine"]', 'comfort'),
(3, '["Nepal", "Peru", "Patagonia"]', '2024-09-01', '2024-09-30', 800.00, 2000.00, '["hiking", "mountains", "adventure", "camping"]', 'budget'),
(4, '["Bali", "Costa Rica", "New Zealand"]', '2024-08-15', '2024-09-15', 1200.00, 2500.00, '["beaches", "surfing", "yoga", "nature"]', 'mid-range');

INSERT INTO trips (creator_id, title, description, destination, start_date, end_date, budget_per_person, max_participants, trip_type) VALUES
(1, 'Cherry Blossom Tour in Japan', 'Join me for a 2-week photography tour of Japan during cherry blossom season. We will visit Tokyo, Kyoto, and Osaka.', 'Japan', '2024-04-01', '2024-04-14', 2500.00, 3, 'cultural'),
(2, 'Art and History Tour of Italy', 'Exploring Renaissance art and Roman history across Italy. Perfect for art lovers and history buffs.', 'Italy', '2024-05-15', '2024-05-30', 3200.00, 4, 'cultural'),
(3, 'Everest Base Camp Trek', 'Challenging trek to Everest Base Camp. Looking for experienced hikers only.', 'Nepal', '2024-10-01', '2024-10-21', 1800.00, 2, 'adventure');
