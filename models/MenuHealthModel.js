import mongoose from 'mongoose';

const MenuHealthSchema = new mongoose.Schema({
  ob_type: {
    type: String,
    required: true,
  },
  id_code_th: {
    type: String,
    required: true,
  },
  image_icon: {
    type: String,
  },
  shot_name: {
    type: String,
  },
});

export default mongoose.models.MenuHealth || mongoose.model('MenuHealth', MenuHealthSchema, 'menu_ob_health');
