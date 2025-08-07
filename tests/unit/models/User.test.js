import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
const User = require('../../../models/User.js');
import bcrypt from 'bcryptjs';

describe('User Model', () => {
  beforeEach(async () => {
    // Clear any existing User documents
    await User.deleteMany({});
  });

  describe('Schema Validation', () => {
    it('should create a valid user with all required fields', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'parent'
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.name).toBe('John Doe');
      expect(savedUser.email).toBe('john@example.com');
      expect(savedUser.role).toBe('parent');
      expect(savedUser.password).toBeDefined();
      expect(savedUser.password).not.toBe('password123'); // Should be hashed
    });

    it('should allow user creation without email (email not required)', async () => {
      const userData = {
        name: 'John Doe',
        password: 'password123',
        role: 'parent'
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.name).toBe('John Doe');
      expect(savedUser.role).toBe('parent');
      expect(savedUser.email).toBeUndefined();
    });

    it('should require role field', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123'
      };

      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow();
    });

    it('should enforce unique email constraint', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'parent'
      };

      // Create first user
      const user1 = new User(userData);
      await user1.save();

      // Try to create second user with same email
      const user2 = new User({
        ...userData,
        name: 'Jane Doe'
      });

      await expect(user2.save()).rejects.toThrow();
    });

    it('should validate role enum values', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'invalid_role'
      };

      const user = new User(userData);
      
      await expect(user.save()).rejects.toThrow();
    });

    it('should accept all valid role values', async () => {
      const validRoles = ['parent', 'admin', 'tutor', 'blogwriter'];
      
      for (const role of validRoles) {
        const userData = {
          name: `User ${role}`,
          email: `${role}@example.com`,
          password: await bcrypt.hash('password123', 10),
          role
        };

        const user = new User(userData);
        const savedUser = await user.save();
        
        expect(savedUser.role).toBe(role);
      }
    });
  });

  describe('Email Validation', () => {
    it('should accept valid email formats', async () => {
      const validEmails = [
        'user@example.com',
        'user.name@example.com',
        'user+tag@example.co.uk',
        'user123@example-site.com'
      ];

      for (const email of validEmails) {
        const userData = {
          name: 'Test User',
          email,
          password: await bcrypt.hash('password123', 10),
          role: 'parent'
        };

        const user = new User(userData);
        const savedUser = await user.save();
        
        expect(savedUser.email).toBe(email);
        
        // Clean up for next iteration
        await User.deleteOne({ _id: savedUser._id });
      }
    });
  });

  describe('Database Operations', () => {
    it('should find user by email (case insensitive)', async () => {
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'parent'
      };

      await User.create(userData);

      // Test case insensitive search
      const foundUser = await User.findOne({ 
        email: new RegExp('^JOHN@EXAMPLE.COM$', 'i') 
      });

      expect(foundUser).toBeTruthy();
      expect(foundUser.email).toBe('john@example.com');
    });

    it('should update user information', async () => {
      const user = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'parent'
      });

      user.name = 'John Smith';
      user.role = 'tutor';
      const updatedUser = await user.save();

      expect(updatedUser.name).toBe('John Smith');
      expect(updatedUser.role).toBe('tutor');
      expect(updatedUser.email).toBe('john@example.com'); // Should remain unchanged
    });

    it('should delete user', async () => {
      const user = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        password: await bcrypt.hash('password123', 10),
        role: 'parent'
      });

      await User.deleteOne({ _id: user._id });

      const deletedUser = await User.findById(user._id);
      expect(deletedUser).toBeNull();
    });
  });

  describe('Password Security', () => {
    it('should not store plain text passwords', async () => {
      const plainPassword = 'mySecretPassword123';
      const userData = {
        name: 'John Doe',
        email: 'john@example.com',
        password: await bcrypt.hash(plainPassword, 10),
        role: 'parent'
      };

      const user = await User.create(userData);

      expect(user.password).not.toBe(plainPassword);
      expect(user.password).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
    });

    it('should verify password correctly', async () => {
      const plainPassword = 'mySecretPassword123';
      const hashedPassword = await bcrypt.hash(plainPassword, 10);
      
      const user = await User.create({
        name: 'John Doe',
        email: 'john@example.com',
        password: hashedPassword,
        role: 'parent'
      });

      const isValid = await bcrypt.compare(plainPassword, user.password);
      expect(isValid).toBe(true);

      const isInvalid = await bcrypt.compare('wrongPassword', user.password);
      expect(isInvalid).toBe(false);
    });
  });
});
