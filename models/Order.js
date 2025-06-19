const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    page: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true 
    },
    order: { 
        type: [String], 
        default: [] 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
}, {
    timestamps: true
});

// Add index for better query performance
orderSchema.index({ page: 1, updatedAt: -1 });

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
