import mongoose from 'mongoose';

const GeoJSONFeatureSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    featureType: {
      type: String,
      enum: ['ward', 'subcircuit', 'service-area', 'zone', 'other'],
      default: 'other',
    },
    geometry: {
      type: mongoose.Schema.Types.Mixed, // GeoJSON geometry object
      required: true,
    },
    properties: {
      type: mongoose.Schema.Types.Mixed, // arbitrary key-value
      default: {},
    },
    color: {
      type: String,
      default: '#3B82F6',
    },
    appId: {
      type: String,
      required: true,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

GeoJSONFeatureSchema.index({ appId: 1, active: 1 });

export default mongoose.models.GeoJSONFeature ||
  mongoose.model('GeoJSONFeature', GeoJSONFeatureSchema);
