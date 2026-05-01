# Travel Together - A Travel Buddy Finder System

A comprehensive web-based platform that helps users find compatible travel buddies based on destination, travel dates, interests, and preferences.

## 🚀 Features

- **User Authentication**: Secure signup/login with password encryption
- **Profile Management**: Complete profile setup with interests, preferences, and photo upload
- **Smart Matching Algorithm**: Advanced compatibility scoring based on multiple factors
- **Search & Filter**: Find travel buddies by destination, dates, and interests
- **Messaging System**: Real-time communication between matched users
- **Trip Planning**: Create and manage travel trips with group functionality
- **Responsive Design**: Mobile-friendly interface with modern UI

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: PHP 7.4+
- **Database**: MySQL 8.0+
- **Icons**: Font Awesome 6.0
- **Styling**: Custom CSS with Flexbox/Grid

## 📋 Prerequisites

- **Web Server**: Apache/Nginx with PHP support
- **PHP**: Version 7.4 or higher
- **MySQL**: Version 8.0 or higher
- **Extensions**: PDO, GD (for image processing)

## 🔧 Installation

### 1. Clone/Download the Project
```bash
# If using Git
git clone <repository-url>

# Or download and extract the ZIP file to your web server directory
```

### 2. Database Setup
```sql
-- Create database
CREATE DATABASE travel_together;

-- Import the schema
mysql -u root -p travel_together < database/schema.sql
```

### 3. Configuration
Edit `php/config.php` and update the database credentials:
```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'travel_together');
define('DB_USER', 'your_mysql_username');
define('DB_PASS', 'your_mysql_password');
```

### 4. Directory Permissions
Create and set permissions for upload directories:
```bash
mkdir uploads/profiles
chmod 755 uploads/profiles
```

### 5. Web Server Configuration

#### Apache (.htaccess)
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^api/(.*)$ php/$1.php [QSA,L]
```

#### Nginx
```nginx
location /api/ {
    rewrite ^/api/(.*)$ /php/$1.php last;
}
```

## 🚀 Usage

### 1. Start Your Web Server
- **XAMPP/WAMP**: Start Apache and MySQL services
- **Local Development**: Use PHP built-in server
```bash
php -S localhost:8000
```

### 2. Access the Application
Open your browser and navigate to:
- Local: `http://localhost/travel-together/`
- Or: `http://localhost:8000/` (if using PHP built-in server)

### 3. Create Your First Account
1. Click "Sign Up" on the homepage
2. Fill in your details and create an account
3. Complete the 4-step profile setup
4. Start finding travel buddies!

## 📁 Project Structure

```
travel-together/
├── index.html              # Landing page
├── dashboard.html           # User dashboard
├── profile-setup.html       # Profile completion wizard
├── css/
│   ├── style.css           # Main styles
│   ├── dashboard.css       # Dashboard-specific styles
│   └── profile.css         # Profile page styles
├── js/
│   ├── main.js             # Core JavaScript functionality
│   ├── dashboard.js        # Dashboard interactions
│   └── profile-setup.js    # Profile setup wizard
├── php/
│   ├── config.php          # Database configuration
│   ├── auth.php            # Authentication handlers
│   ├── profile.php         # Profile management
│   ├── matches.php         # Matching algorithm
│   └── dashboard.php       # Dashboard data
├── database/
│   └── schema.sql          # Database schema
├── uploads/                # User uploaded files
│   └── profiles/           # Profile photos
└── README.md               # This file
```

## 🎯 Key Features Explained

### Matching Algorithm
The system uses a sophisticated compatibility scoring algorithm that considers:
- **Common Interests** (25 points): Shared hobbies and activities
- **Destination Overlap** (20 points): Similar travel destinations
- **Travel Style** (15 points): Budget, luxury, backpacking, etc.
- **Budget Compatibility** (15 points): Overlapping budget ranges
- **Group Size Preference** (10 points): Preferred number of travel companions
- **Language Compatibility** (10 points): Shared languages
- **Date Overlap** (5 points): Overlapping travel dates

### Security Features
- Password hashing using PHP's `password_hash()`
- SQL injection prevention with prepared statements
- File upload validation and sanitization
- Session management for authentication
- CSRF protection for forms

## 🔧 Customization

### Adding New Interests
Edit the interests section in `profile-setup.html`:
```html
<label class="interest-option">
    <input type="checkbox" name="interests" value="new-interest">
    <span><i class="fas fa-icon"></i> New Interest</span>
</label>
```

### Modifying Matching Algorithm
Update the `calculateCompatibilityScore()` function in `php/matches.php` to adjust scoring weights or add new factors.

### Styling Changes
- Main colors are defined as CSS variables in `css/style.css`
- Responsive breakpoints: 768px (tablet), 480px (mobile)
- Font Awesome icons can be changed by updating class names

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check MySQL service is running
   - Verify credentials in `config.php`
   - Ensure database exists

2. **File Upload Not Working**
   - Check `uploads/profiles/` directory exists
   - Verify directory permissions (755)
   - Check PHP `upload_max_filesize` setting

3. **JavaScript Errors**
   - Check browser console for errors
   - Ensure all JavaScript files are loaded
   - Verify API endpoints are accessible

4. **Styling Issues**
   - Clear browser cache
   - Check CSS file paths
   - Verify Font Awesome CDN is accessible

## 📱 Mobile Responsiveness

The application is fully responsive and works on:
- Desktop computers (1200px+)
- Tablets (768px - 1199px)
- Mobile phones (320px - 767px)

## 🔒 Security Considerations

- Change default JWT secret in production
- Use HTTPS in production environment
- Implement rate limiting for API endpoints
- Regular security updates for dependencies
- Backup database regularly

## 🚀 Deployment

### Production Checklist
- [ ] Update database credentials
- [ ] Change JWT secret key
- [ ] Enable HTTPS
- [ ] Set up proper error logging
- [ ] Configure email settings for notifications
- [ ] Set up regular database backups
- [ ] Optimize images and assets
- [ ] Enable gzip compression

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for JavaScript errors
3. Check PHP error logs for server-side issues
4. Ensure all prerequisites are met

## 📄 License

This project is open source and available under the MIT License.

---

**Happy Traveling! 🌍✈️**
