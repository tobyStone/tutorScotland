import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../../../models/user.js';

/**
 * Create a test user with hashed password
 */
export async function createTestUser(userData = {}) {
  const defaultData = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'testpassword123',
    role: 'parent'
  };

  const mergedData = { ...defaultData, ...userData };
  
  // Hash the password
  mergedData.password = await bcrypt.hash(mergedData.password, 10);
  
  return await User.create(mergedData);
}

/**
 * Generate a JWT token for testing
 */
export function generateTestToken(payload = {}) {
  const defaultPayload = {
    id: 'test-user-id',
    role: 'admin'
  };

  const mergedPayload = { ...defaultPayload, ...payload };
  
  return jwt.sign(mergedPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Generate an expired JWT token for testing
 */
export function generateExpiredToken(payload = {}) {
  const defaultPayload = {
    id: 'test-user-id',
    role: 'admin'
  };

  const mergedPayload = { ...defaultPayload, ...payload };
  
  return jwt.sign(mergedPayload, process.env.JWT_SECRET, { expiresIn: '-1h' });
}

/**
 * Create admin user and return with token
 */
export async function createAdminWithToken() {
  const admin = await createTestUser({
    name: 'Admin User',
    email: 'admin@tutorscotland.test',
    role: 'admin'
  });

  const token = generateTestToken({
    id: admin._id.toString(),
    role: 'admin'
  });

  return { admin, token };
}

/**
 * Create parent user and return with token
 */
export async function createParentWithToken() {
  const parent = await createTestUser({
    name: 'Parent User',
    email: 'parent@tutorscotland.test',
    role: 'parent'
  });

  const token = generateTestToken({
    id: parent._id.toString(),
    role: 'parent'
  });

  return { parent, token };
}

/**
 * Create tutor user and return with token
 */
export async function createTutorWithToken() {
  const tutor = await createTestUser({
    name: 'Tutor User',
    email: 'tutor@tutorscotland.test',
    role: 'tutor'
  });

  const token = generateTestToken({
    id: tutor._id.toString(),
    role: 'tutor'
  });

  return { tutor, token };
}

/**
 * Create blog writer user and return with token
 */
export async function createBlogWriterWithToken() {
  const blogWriter = await createTestUser({
    name: 'Blog Writer',
    email: 'blogger@tutorscotland.test',
    role: 'blogwriter'
  });

  const token = generateTestToken({
    id: blogWriter._id.toString(),
    role: 'blogwriter'
  });

  return { blogWriter, token };
}

/**
 * Verify password against hash
 */
export async function verifyPassword(plainPassword, hashedPassword) {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Create cookie string for testing
 */
export function createCookieString(token) {
  return `token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=10800`;
}

/**
 * Extract token from cookie header
 */
export function extractTokenFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  
  const tokenMatch = cookieHeader.match(/token=([^;]+)/);
  return tokenMatch ? tokenMatch[1] : null;
}

/**
 * Verify JWT token and return payload
 */
export function verifyTestToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error(`Invalid token: ${error.message}`);
  }
}
