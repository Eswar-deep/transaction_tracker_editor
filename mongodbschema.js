const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  Date: { type: Date, required: true },
  Description: { type: String, required: true },
  Amount: { type: Number, required: true },
  Currency: { type: String, required: true },
  INR_AMOUNT:{ type: Number, required: true }
});

const Payment = mongoose.model("payments", paymentSchema);

module.exports = Payment;
