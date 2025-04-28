import mongoose from 'mongoose';

const AttachmentSchema = new mongoose.Schema({
    url: { type: String, required: true, require: true },
    name: { type: String, required: true },
    type: { type: String, enum: ['image', 'file'], required: true },
    size: { type: Number, required: true },
});

const Attachment = mongoose.model('Attachment', AttachmentSchema);

export default Attachment;
