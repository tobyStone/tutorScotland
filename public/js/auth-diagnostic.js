/**
 * @fileoverview Authentication diagnostic utility
 * @description Helps diagnose authentication issues by checking various auth states
 */

class AuthDiagnostic {
    constructor() {
        this.results = {};
    }

    async runDiagnostics() {
        console.log('🔍 Running authentication diagnostics...');
        
        // Check 1: Cookie presence
        await this.checkCookies();
        
        // Check 2: Protected endpoint
        await this.checkProtectedEndpoint();
        
        // Check 3: Content manager endpoint
        await this.checkContentManagerEndpoint();
        
        // Check 4: Login check endpoint
        await this.checkLoginEndpoint();
        
        // Display results
        this.displayResults();
        
        return this.results;
    }

    checkCookies() {
        console.log('🍪 Checking cookies...');
        
        const cookies = document.cookie.split(';').reduce((acc, cookie) => {
            const [name, value] = cookie.trim().split('=');
            acc[name] = value;
            return acc;
        }, {});
        
        this.results.cookies = {
            all: cookies,
            hasToken: !!cookies.token,
            tokenLength: cookies.token ? cookies.token.length : 0,
            cookieCount: Object.keys(cookies).length
        };
        
        console.log('🍪 Cookie check results:', this.results.cookies);
    }

    async checkProtectedEndpoint() {
        console.log('🔒 Checking protected endpoint...');
        
        try {
            const response = await fetch('/api/protected?role=admin', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            this.results.protected = {
                status: response.status,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries())
            };
            
            if (response.ok) {
                this.results.protected.data = await response.json();
            } else {
                this.results.protected.error = await response.text();
            }
            
        } catch (error) {
            this.results.protected = {
                error: error.message,
                stack: error.stack
            };
        }
        
        console.log('🔒 Protected endpoint results:', this.results.protected);
    }

    async checkContentManagerEndpoint() {
        console.log('📝 Checking content manager endpoint...');
        
        try {
            const response = await fetch('/api/content-manager?operation=get-order&page=index', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            this.results.contentManager = {
                status: response.status,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries())
            };
            
            if (response.ok) {
                this.results.contentManager.data = await response.json();
            } else {
                this.results.contentManager.error = await response.text();
            }
            
        } catch (error) {
            this.results.contentManager = {
                error: error.message,
                stack: error.stack
            };
        }
        
        console.log('📝 Content manager results:', this.results.contentManager);
    }

    async checkLoginEndpoint() {
        console.log('🔑 Checking login endpoint...');
        
        try {
            const response = await fetch('/api/login?check=admin', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            this.results.login = {
                status: response.status,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries())
            };
            
            if (response.ok) {
                this.results.login.data = await response.json();
            } else {
                this.results.login.error = await response.text();
            }
            
        } catch (error) {
            this.results.login = {
                error: error.message,
                stack: error.stack
            };
        }
        
        console.log('🔑 Login endpoint results:', this.results.login);
    }

    displayResults() {
        console.log('\n🔍 AUTHENTICATION DIAGNOSTIC SUMMARY');
        console.log('=====================================');
        
        console.log('\n🍪 COOKIES:');
        console.log(`  - Has token: ${this.results.cookies.hasToken}`);
        console.log(`  - Token length: ${this.results.cookies.tokenLength}`);
        console.log(`  - Total cookies: ${this.results.cookies.cookieCount}`);
        
        console.log('\n🔒 PROTECTED ENDPOINT:');
        console.log(`  - Status: ${this.results.protected.status}`);
        console.log(`  - Success: ${this.results.protected.ok}`);
        
        console.log('\n📝 CONTENT MANAGER:');
        console.log(`  - Status: ${this.results.contentManager.status}`);
        console.log(`  - Success: ${this.results.contentManager.ok}`);
        
        console.log('\n🔑 LOGIN CHECK:');
        console.log(`  - Status: ${this.results.login.status}`);
        console.log(`  - Success: ${this.results.login.ok}`);
        
        // Analysis
        console.log('\n📊 ANALYSIS:');
        if (!this.results.cookies.hasToken) {
            console.log('  ❌ No authentication token found - user needs to log in');
        } else if (this.results.protected.ok && !this.results.contentManager.ok) {
            console.log('  ⚠️ Protected endpoint works but content manager fails - possible cookie/auth issue');
        } else if (this.results.protected.ok && this.results.contentManager.ok) {
            console.log('  ✅ Authentication appears to be working correctly');
        } else {
            console.log('  ❌ Authentication issues detected');
        }
    }
}

// Make it available globally for debugging
window.AuthDiagnostic = AuthDiagnostic;

// Auto-run if in development or if explicitly requested
if (window.location.hostname === 'localhost' || window.location.search.includes('debug=auth')) {
    const diagnostic = new AuthDiagnostic();
    diagnostic.runDiagnostics().then(results => {
        console.log('🔍 Diagnostic complete. Results available in window.authDiagnosticResults');
        window.authDiagnosticResults = results;
    });
}
