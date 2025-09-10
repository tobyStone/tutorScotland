# Security Recommendations

## 🎯 **Executive Summary**
This document outlines critical security recommendations for the Tutors Alliance Scotland platform, addressing current vulnerabilities and providing a roadmap for enhanced security posture.

## 🚨 **Critical Security Issues**

### **1. Authentication & Authorization**

#### **Current Issues**
- ✅ ~~JWT tokens stored in localStorage~~ **FIXED: Already using HTTP-only cookies**
- No CSRF protection on admin forms
- Session management lacks proper expiration (currently 3 hours - reasonable)
- Admin role validation inconsistent across endpoints

#### **Recommendations**
```javascript
// ✅ ALREADY IMPLEMENTED: HTTP-only cookies for JWT storage
// Current implementation in api/login.js:
const serializedCookie = serialize('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 3 * 60 * 60, // 3 hours in seconds
    path: '/'
});
res.setHeader('Set-Cookie', serializedCookie);

// ENHANCEMENT: Add SameSite protection
const serializedCookie = serialize('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict', // ADD THIS for CSRF protection
    maxAge: 3 * 60 * 60,
    path: '/'
});

// Add CSRF protection
const csrf = require('csurf');
app.use(csrf({ cookie: true }));
```

### **2. Input Validation & Sanitization**

#### **Current Issues**
- Insufficient input validation on API endpoints
- No HTML sanitization for user-generated content
- File upload validation relies only on MIME types
- SQL injection potential in dynamic queries

#### **Recommendations**
```javascript
// Implement comprehensive input validation
const { body, validationResult } = require('express-validator');

const validateBlogPost = [
    body('title').isLength({ min: 1, max: 200 }).escape(),
    body('content').isLength({ min: 1 }).customSanitizer(value => {
        return DOMPurify.sanitize(value);
    }),
    body('author').isLength({ min: 1, max: 100 }).escape()
];

// File upload security
const multer = require('multer');
const upload = multer({
    limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
    fileFilter: (req, file, cb) => {
        // Validate file signature, not just MIME type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'), false);
        }
    }
});
```

### **3. Data Protection**

#### **Current Issues**
- Sensitive data logged in console
- No encryption for sensitive database fields
- Backup data not encrypted
- Personal data retention policy unclear

#### **Recommendations**
```javascript
// Implement field-level encryption
const crypto = require('crypto');

const encryptSensitiveData = (data) => {
    const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
};

// Sanitize logs
const sanitizeLog = (data) => {
    const sensitive = ['password', 'email', 'token', 'key'];
    const sanitized = { ...data };
    sensitive.forEach(field => {
        if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
        }
    });
    return sanitized;
};
```

## 🛡️ **Security Implementation Roadmap**

### **Phase 1: IMMEDIATE Critical Fixes (Week 1)**
1. **🚨 URGENT: Add Authentication to Unprotected Endpoints**
   - **Priority 1**: `/api/content-manager` - Content override management
   - **Priority 1**: `/api/sections` - Dynamic sections management
   - **Priority 1**: `/api/upload-image` - File upload system
   - **Priority 1**: `/api/video-sections` - Video content management

   ```javascript
   // Template for adding authentication to vulnerable endpoints
   const { verify } = require('./protected');

   module.exports = async (req, res) => {
       // Add authentication check for write operations
       if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
           const [ok, payload] = verify(req, res);
           if (!ok) {
               return res.status(401).json({ message: 'Authentication required' });
           }
           if (payload.role !== 'admin') {
               return res.status(403).json({ message: 'Admin access required' });
           }
       }
       // ... existing handler logic
   };
   ```

2. **🚨 URGENT: Implement Rate Limiting**
   ```javascript
   const rateLimit = require('express-rate-limit');

   // Login rate limiting (prevent brute force)
   const loginLimiter = rateLimit({
       windowMs: 15 * 60 * 1000, // 15 minutes
       max: 5, // 5 attempts per window
       message: 'Too many login attempts, please try again later'
   });

   // General API rate limiting
   const apiLimiter = rateLimit({
       windowMs: 15 * 60 * 1000, // 15 minutes
       max: 100, // 100 requests per window
       message: 'Too many requests, please try again later'
   });

   app.use('/api/login', loginLimiter);
   app.use('/api/', apiLimiter);
   ```

3. **🚨 URGENT: Implement Login Security Controls**
   ```javascript
   // Add to api/login.js - Failed attempt tracking
   const loginAttempts = new Map(); // In production, use Redis/database

   module.exports = async (req, res) => {
       const clientIP = req.ip || req.connection.remoteAddress;
       const email = req.body.email;

       // Check for too many failed attempts
       const attemptKey = `${clientIP}:${email}`;
       const attempts = loginAttempts.get(attemptKey) || { count: 0, lastAttempt: 0 };

       if (attempts.count >= 5 && Date.now() - attempts.lastAttempt < 15 * 60 * 1000) {
           return res.status(429).json({
               message: 'Too many failed attempts. Try again in 15 minutes.'
           });
       }

       // ... existing login logic ...

       // On failed login:
       if (!isMatch) {
           attempts.count++;
           attempts.lastAttempt = Date.now();
           loginAttempts.set(attemptKey, attempts);

           // Log security event
           console.warn(`Failed login attempt for ${email} from ${clientIP}`);

           return res.status(400).json({ message: 'Invalid credentials' });
       }

       // On successful login - reset attempts
       loginAttempts.delete(attemptKey);
       // ... rest of success logic
   };
   ```

4. **Add Input Validation and Sanitization**
   - Install express-validator and DOMPurify
   - Add validation to all public endpoints
   - Sanitize all user-generated content

### **Phase 2: Enhanced Security (Week 2-3)**
1. **✅ ~~Migrate JWT to HTTP-only cookies~~** **ALREADY IMPLEMENTED**
   - ✅ HTTP-only cookies already implemented in login.js
   - ✅ Client-side auth checks already use cookies
   - **ENHANCEMENT**: Add SameSite=strict to cookies for CSRF protection

2. **Add CSRF protection**
   - Install and configure csurf middleware
   - Update all admin forms with CSRF tokens
   - Add CSRF validation to API endpoints

3. **Comprehensive Input Validation**
   - Add validation middleware to all API endpoints
   - Sanitize HTML content with DOMPurify
   - Validate file uploads with magic number checking
   - Implement query parameter validation for public endpoints

4. **Database query security**
   - Use parameterized queries exclusively
   - Implement query result sanitization
   - Add database connection encryption

### **Phase 3: Monitoring & Logging (Week 5-6)**
1. **Security logging**
   ```javascript
   const winston = require('winston');
   
   const securityLogger = winston.createLogger({
       level: 'info',
       format: winston.format.json(),
       transports: [
           new winston.transports.File({ filename: 'security.log' })
       ]
   });
   
   // Log security events
   const logSecurityEvent = (event, user, details) => {
       securityLogger.info({
           timestamp: new Date().toISOString(),
           event,
           user: user?.id || 'anonymous',
           ip: req.ip,
           userAgent: req.get('User-Agent'),
           details: sanitizeLog(details)
       });
   };
   ```

2. **Intrusion detection**
   - Monitor failed login attempts
   - Track unusual API usage patterns
   - Alert on suspicious file uploads

## 🔐 **Specific Endpoint Security**

### **Admin Endpoints**
```javascript
// content-manager.js security enhancements
const adminAuth = async (req, res, next) => {
    try {
        const token = req.cookies.adminToken;
        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.role !== 'admin') {
            logSecurityEvent('UNAUTHORIZED_ADMIN_ACCESS', decoded, { endpoint: req.path });
            return res.status(403).json({ message: 'Admin access required' });
        }
        
        req.user = decoded;
        next();
    } catch (error) {
        logSecurityEvent('INVALID_TOKEN', null, { error: error.message });
        return res.status(401).json({ message: 'Invalid token' });
    }
};
```

### **File Upload Security**
```javascript
// upload-image.js security enhancements
const validateImageFile = (file) => {
    // Check file signature (magic numbers)
    const jpegSignature = Buffer.from([0xFF, 0xD8, 0xFF]);
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47]);
    
    const fileBuffer = file.buffer.slice(0, 4);
    
    if (!fileBuffer.includes(jpegSignature) && !fileBuffer.includes(pngSignature)) {
        throw new Error('Invalid file signature');
    }
    
    // Additional checks
    if (file.size > 4 * 1024 * 1024) {
        throw new Error('File too large');
    }
    
    return true;
};
```

## 🚨 **Incident Response Plan**

### **Security Incident Classification**
- **Critical**: Data breach, admin account compromise
- **High**: Unauthorized access attempts, file upload exploits
- **Medium**: Rate limit violations, suspicious patterns
- **Low**: Failed login attempts, minor validation errors

### **Response Procedures**
1. **Immediate Response**
   - Isolate affected systems
   - Preserve evidence
   - Notify stakeholders

2. **Investigation**
   - Analyze security logs
   - Identify attack vectors
   - Assess data exposure

3. **Recovery**
   - Patch vulnerabilities
   - Reset compromised credentials
   - Update security measures

4. **Post-Incident**
   - Document lessons learned
   - Update security procedures
   - Conduct security review

## 📊 **Security Metrics & Monitoring**

### **Key Performance Indicators**
- Failed login attempts per hour
- API endpoint response times (potential DoS indicator)
- File upload rejection rate
- Admin action frequency
- Database query execution times

### **Automated Alerts**
```javascript
// Security alert system
const sendSecurityAlert = (severity, message, details) => {
    if (severity === 'CRITICAL') {
        // Immediate notification
        emailAlert(process.env.SECURITY_EMAIL, message, details);
        slackAlert(process.env.SECURITY_SLACK_WEBHOOK, message);
    }
    
    // Log all security events
    securityLogger.error({
        severity,
        message,
        details,
        timestamp: new Date().toISOString()
    });
};
```

## 🔄 **Regular Security Maintenance**

### **Weekly Tasks**
- Review security logs
- Check for failed login patterns
- Monitor file upload attempts
- Verify backup integrity

### **Monthly Tasks**
- Update dependencies (npm audit)
- Review user access permissions
- Test incident response procedures
- Security training for development team

### **Quarterly Tasks**
- Comprehensive security audit
- Penetration testing
- Update security documentation
- Review and update security policies

## 🌐 **Infrastructure Security**

### **Vercel Platform Security**
```json
// vercel.json security headers
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        }
      ]
    }
  ]
}
```

### **Environment Variables Security**
- Store all secrets in Vercel environment variables
- Use different keys for development/production
- Rotate secrets regularly
- Never commit secrets to version control

### **Database Security (MongoDB)**
```javascript
// Connection security
const mongoOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    ssl: true,
    sslValidate: true,
    authSource: 'admin',
    retryWrites: true,
    w: 'majority'
};

// Connection string validation
const validateConnectionString = (uri) => {
    if (!uri.includes('ssl=true')) {
        throw new Error('Database connection must use SSL');
    }
    if (!uri.includes('authSource=admin')) {
        throw new Error('Database must use admin auth source');
    }
};
```

## 🔍 **Security Testing**

### **Automated Security Testing**
```javascript
// Security test suite
describe('Security Tests', () => {
    test('Admin endpoints require authentication', async () => {
        const response = await request(app)
            .post('/api/content-manager')
            .send({ operation: 'create' });
        expect(response.status).toBe(401);
    });

    test('File upload validates file types', async () => {
        const response = await request(app)
            .post('/api/upload-image')
            .attach('file', Buffer.from('malicious script'), 'test.js');
        expect(response.status).toBe(400);
    });

    test('Input validation prevents XSS', async () => {
        const response = await request(app)
            .post('/api/blog-writer')
            .send({
                title: '<script>alert("xss")</script>',
                content: 'test content'
            });
        expect(response.body.title).not.toContain('<script>');
    });
});
```

### **Manual Security Checklist**
- [ ] All admin endpoints require authentication
- [ ] CSRF tokens present on all forms
- [ ] File uploads validate file signatures
- [ ] User input is sanitized and validated
- [ ] Sensitive data is not logged
- [ ] Database queries use parameterization
- [ ] Security headers are properly set
- [ ] Rate limiting is implemented
- [ ] Error messages don't leak sensitive information
- [ ] Session management is secure

## 📋 **Compliance Considerations**

### **GDPR Compliance**
- Implement data subject rights (access, deletion, portability)
- Maintain data processing records
- Implement privacy by design
- Conduct data protection impact assessments

### **Data Retention Policy**
```javascript
// Automated data cleanup
const cleanupOldData = async () => {
    // Remove old logs after 90 days
    await SecurityLog.deleteMany({
        createdAt: { $lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
    });

    // Archive old blog posts after 2 years
    await Blog.updateMany(
        { createdAt: { $lt: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000) } },
        { status: 'archived' }
    );
};
```

## 🎯 **Security Training & Awareness**

### **Developer Security Training**
- Secure coding practices
- Common vulnerability patterns (OWASP Top 10)
- Security testing methodologies
- Incident response procedures

### **Security Code Review Checklist**
- [ ] Authentication and authorization properly implemented
- [ ] Input validation and sanitization present
- [ ] Error handling doesn't leak sensitive information
- [ ] Logging excludes sensitive data
- [ ] Dependencies are up to date and secure
- [ ] Security headers are configured
- [ ] Rate limiting is appropriate
- [ ] File uploads are properly validated

## 🔍 **API Security Analysis**

### **Current API Route Security Status**

| API Route | Authentication | Input Validation | File Security | Risk Level |
|-----------|---------------|------------------|---------------|------------|
| `/api/login` | ❌ (Login endpoint) | ✅ Basic | N/A | ⚠️ **HIGH** - No rate limiting |
| `/api/protected` | ✅ JWT + Role-based | ✅ Role validation | N/A | ✅ **LOW** |
| `/api/addTutor` | ✅ Admin only | ✅ Required fields | N/A | ✅ **LOW** |
| `/api/blog-writer` | ⚠️ Mixed (GET unprotected) | ✅ Basic | N/A | ⚠️ **MEDIUM** |
| `/api/content-manager` | ❌ **MISSING** | ❌ **MISSING** | N/A | 🚨 **CRITICAL** |
| `/api/sections` | ❌ **MISSING** | ⚠️ Basic | ✅ File validation | 🚨 **CRITICAL** |
| `/api/upload-image` | ❌ **MISSING** | ✅ **STRONG** | ✅ **EXCELLENT** | 🚨 **CRITICAL** |
| `/api/tutors` | ❌ Public | ❌ **MISSING** | N/A | ⚠️ **MEDIUM** |
| `/api/content-display` | ❌ Public | ❌ **MISSING** | N/A | ⚠️ **MEDIUM** |
| `/api/video-sections` | ❌ **MISSING** | ✅ Basic | ✅ Video validation | 🚨 **CRITICAL** |

### **🚨 Critical Vulnerabilities Requiring Immediate Action**

#### **1. Unauthenticated Content Management (CRITICAL)**
```javascript
// VULNERABLE: Anyone can modify website content
// /api/content-manager - No authentication check
// /api/sections - No authentication check
// /api/video-sections - No authentication check

// REQUIRED FIX: Add authentication to all write operations
const { verify } = require('./protected');

module.exports = async (req, res) => {
    // Add authentication check for write operations
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        const [ok, payload] = verify(req, res);
        if (!ok) {
            return res.status(401).json({ message: 'Authentication required' });
        }
        if (payload.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
    }
    // ... rest of handler
};
```

#### **2. Unauthenticated File Uploads (CRITICAL)**
```javascript
// VULNERABLE: Anyone can upload files
// /api/upload-image - No authentication check

// REQUIRED FIX: Add authentication
module.exports = async (req, res) => {
    // Add authentication check
    const { verify } = require('./protected');
    const [ok, payload] = verify(req, res);
    if (!ok) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    // ... existing upload logic
};
```

#### **3. Missing Rate Limiting (HIGH)**
```javascript
// VULNERABLE: No protection against brute force
// /api/login - No rate limiting

// REQUIRED FIX: Implement rate limiting
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many login attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
});

// Apply to login endpoint
app.use('/api/login', loginLimiter);
```

### **✅ Strong Security Implementations**

#### **File Upload Security (`/api/upload-image`)**
- ✅ **Multi-layer file validation**: MIME type + Sharp format detection
- ✅ **Size limits**: 4MB images, 4.5MB videos, 1GB Google Cloud
- ✅ **Dimension validation**: Maximum 2000px width/height
- ✅ **Filename sanitization**: Prevents directory traversal
- ✅ **Concurrent upload limiting**: Prevents resource exhaustion
- ✅ **Corrupted file detection**: Validates image integrity
- ✅ **Hash-based deduplication**: Prevents duplicate uploads

#### **Authentication System (`/api/protected`)**
- ✅ **JWT validation**: Secure token verification
- ✅ **HTTP-only cookies**: Prevents XSS token theft
- ✅ **Role-based access**: Admin/user role separation
- ✅ **Proper error handling**: No information leakage

### **⚠️ Moderate Security Concerns**

#### **Mixed Authentication (`/api/blog-writer`)**
- **Issue**: GET requests unprotected, write operations authenticated
- **Risk**: Information disclosure through unprotected reads
- **Fix**: Implement consistent authentication policy

#### **Input Validation Gaps**
- **`/api/tutors`**: No validation on search parameters (injection risk)
- **`/api/content-display`**: No validation on page parameters
- **`/api/content-manager`**: No input sanitization for overrides

## 🔐 **Current Login & Upload Security Analysis**

### **🚨 Critical Login Security Gaps**

#### **1. No Rate Limiting (CRITICAL)**
```javascript
// CURRENT STATE: Unlimited login attempts allowed
// /api/login - No protection against brute force attacks

// VULNERABILITY: Attackers can attempt unlimited password combinations
const response = await fetch('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@example.com', password: 'attempt1' })
});
// No delay, no lockout, no tracking - can repeat infinitely
```

#### **2. No Failed Login Tracking (HIGH)**
- **Missing**: Failed attempt logging
- **Missing**: Account lockout after X failed attempts
- **Missing**: IP-based blocking for suspicious activity
- **Missing**: Security event logging

#### **3. No User Registration Controls (HIGH)**
```javascript
// CURRENT STATE: No public user registration endpoint found
// Users must be created manually in database
// RISK: No validation of user creation process
// RISK: No email verification for new accounts
```

#### **4. Weak Session Management (MEDIUM)**
- **Current**: 3-hour JWT expiration (reasonable)
- **Missing**: Session invalidation on suspicious activity
- **Missing**: Concurrent session limits
- **Missing**: "Remember me" vs "Secure session" options

### **🔓 Current Upload Security Status**

#### **Who Can Upload Files Currently:**
```javascript
// CRITICAL VULNERABILITY: ANYONE can upload files
// /api/upload-image has NO authentication check

// Current state allows:
const formData = new FormData();
formData.append('file', maliciousFile);
fetch('/api/upload-image', {
    method: 'POST',
    body: formData
});
// ↑ This succeeds without any login/authentication
```

#### **Upload Vulnerabilities:**
1. **No Authentication**: Anyone can upload files
2. **No User Tracking**: No record of who uploaded what
3. **No Upload Quotas**: Unlimited uploads per user/IP
4. **No Content Scanning**: No malware/virus scanning
5. **No Approval Process**: Files go live immediately

### **✅ Current Security Strengths**

#### **Password Security**
- ✅ **bcrypt hashing**: Passwords properly hashed with salt
- ✅ **Case-insensitive email**: Prevents duplicate accounts
- ✅ **JWT tokens**: Secure token-based authentication
- ✅ **HTTP-only cookies**: Prevents XSS token theft

#### **Role-Based Access**
- ✅ **Multiple roles**: admin, tutor, parent, blogwriter
- ✅ **Role validation**: Proper role checking in protected routes
- ✅ **Admin-only operations**: Tutor management restricted to admins

#### **File Upload Validation (When Auth Added)**
- ✅ **File type validation**: MIME type + Sharp format detection
- ✅ **Size limits**: Reasonable file size restrictions
- ✅ **Filename sanitization**: Prevents directory traversal
- ✅ **Concurrent upload limits**: Prevents resource exhaustion

## 🎯 **Immediate Action Plan for Login & Upload Security**

### **Priority 1: Emergency Fixes (This Week)**

1. **Add Authentication to Upload Endpoints**
   ```javascript
   // Add to api/upload-image.js (TOP PRIORITY)
   const { verify } = require('./protected');

   module.exports = async (req, res) => {
       // CRITICAL: Add authentication check
       const [ok, payload] = verify(req, res);
       if (!ok) {
           return res.status(401).json({ message: 'Authentication required for file uploads' });
       }

       // Optional: Restrict to admin/tutor roles only
       if (!['admin', 'tutor', 'blogwriter'].includes(payload.role)) {
           return res.status(403).json({ message: 'Insufficient permissions for file uploads' });
       }

       // ... existing upload logic
   };
   ```

2. **Implement Login Rate Limiting**
   ```bash
   npm install express-rate-limit express-slow-down
   ```

   ```javascript
   // Add to api/login.js
   const rateLimit = require('express-rate-limit');
   const slowDown = require('express-slow-down');

   const loginLimiter = rateLimit({
       windowMs: 15 * 60 * 1000, // 15 minutes
       max: 5, // 5 attempts per window per IP
       message: { message: 'Too many login attempts, please try again in 15 minutes' },
       standardHeaders: true,
       legacyHeaders: false,
   });

   const speedLimiter = slowDown({
       windowMs: 15 * 60 * 1000, // 15 minutes
       delayAfter: 2, // Allow 2 requests per window at full speed
       delayMs: 500 // Add 500ms delay per request after delayAfter
   });
   ```

3. **Add Security Logging**
   ```javascript
   // Create security-logger.js utility
   const fs = require('fs');
   const path = require('path');

   const logSecurityEvent = (event, details) => {
       const logEntry = {
           timestamp: new Date().toISOString(),
           event,
           ip: details.ip,
           userAgent: details.userAgent,
           email: details.email,
           success: details.success,
           details: details.additional
       };

       // In production, use proper logging service
       console.warn('SECURITY EVENT:', logEntry);

       // Optional: Write to file for analysis
       const logFile = path.join(process.cwd(), 'security.log');
       fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
   };

   module.exports = { logSecurityEvent };
   ```

### **Priority 2: Enhanced Controls (Next Week)**

4. **User Account Management**
   - Create admin interface for user management
   - Add email verification for new accounts
   - Implement password reset functionality
   - Add user activity logging

5. **Upload Quotas and Tracking**
   ```javascript
   // Add to User model
   const userSchema = new mongoose.Schema({
       // ... existing fields
       uploadQuota: { type: Number, default: 100 }, // MB per month
       uploadUsed: { type: Number, default: 0 },
       lastUploadReset: { type: Date, default: Date.now },
       uploads: [{
           filename: String,
           size: Number,
           uploadDate: { type: Date, default: Date.now },
           type: String // 'image', 'video', 'document'
       }]
   });
   ```

6. **Session Security Enhancements**
   - Add concurrent session limits
   - Implement "force logout all sessions"
   - Add session activity tracking
   - Create admin dashboard for active sessions

### **🔍 Security Monitoring Checklist**

- [ ] **Login Attempts**: Monitor failed login patterns
- [ ] **Upload Activity**: Track file upload frequency and sizes
- [ ] **API Usage**: Monitor unusual API request patterns
- [ ] **Admin Actions**: Log all admin operations
- [ ] **Error Rates**: Track 4xx/5xx response patterns
- [ ] **Geographic Access**: Monitor login locations
- [ ] **Session Duration**: Track unusually long sessions
- [ ] **File Access**: Monitor access to uploaded files

This comprehensive security framework provides the foundation for maintaining a secure, compliant, and resilient platform for the Tutors Alliance Scotland charity while protecting the sensitive data of disadvantaged Scottish pupils and their families.
