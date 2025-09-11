# Security Debug Configuration

## Overview

The login system includes configurable debug logging that can be enabled/disabled based on environment settings for security and performance.

## Configuration

### Environment Variables

- `NODE_ENV`: Set to `production` to disable debug logging by default
- `SECURITY_DEBUG`: Set to `true` to force enable debug logging even in production

### Debug Logging Behavior

| Environment | NODE_ENV | SECURITY_DEBUG | Debug Logging |
|-------------|----------|----------------|---------------|
| Development | `development` or unset | any | ✅ **ENABLED** |
| Production | `production` | unset or `false` | ❌ **DISABLED** |
| Production Debug | `production` | `true` | ✅ **ENABLED** |

## What Gets Logged

### Always Logged (Security Critical)
These are always logged regardless of debug settings:

- ✅ **Failed login attempts**: `🚨 FAILED LOGIN: email from IP - Attempt X/5`
- ✅ **Rate limiting events**: `🚨 RATE LIMIT: email from IP - X attempts, Y minutes remaining`
- ✅ **Persistent security log**: All events written to `logs/security.log`

### Debug Only (Conditional)
These are only logged when `DEBUG_ENABLED = true`:

- 🔍 Request tracking and flow details
- 🔍 Rate limit check internal state
- 🔍 Attempt recording before/after states
- 🔍 Map size and key information

## Security Considerations

### ✅ Safe to Keep Debug Logging
- **Development environments**: Always safe
- **Staging environments**: Recommended for testing
- **Production with controlled access**: Safe if logs are properly secured

### ⚠️ Consider Disabling Debug Logging
- **High-traffic production**: Performance impact
- **Shared hosting**: Log files might be accessible to others
- **Compliance requirements**: Some regulations require minimal logging

## Vercel Configuration

### To Disable Debug Logging in Production:
Add to your Vercel environment variables:
```
NODE_ENV=production
```

### To Enable Debug Logging in Production:
Add to your Vercel environment variables:
```
NODE_ENV=production
SECURITY_DEBUG=true
```

## Log File Management

### Location
- **Local**: `logs/security.log`
- **Vercel**: Console logs only (no persistent files in serverless)

### Rotation
Consider implementing log rotation for long-term deployments:
```javascript
// Example: Rotate logs daily
const logFile = `logs/security-${new Date().toISOString().split('T')[0]}.log`;
```

## Monitoring Recommendations

1. **Monitor log file size** in local deployments
2. **Set up alerts** for high rates of failed login attempts
3. **Regular review** of security logs for patterns
4. **Archive old logs** to prevent disk space issues

## Example Usage

```bash
# View recent security events
node utils/view-security-logs.js --tail 20

# Monitor failed login attempts
node utils/view-security-logs.js --level WARN --watch

# Check today's security events
node utils/view-security-logs.js --today
```
