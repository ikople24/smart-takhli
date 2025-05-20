const InputField = ({ label, value, onChange, required = false }) => (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full p-2 border border-gray-300 rounded"
      />
    </div>
  );
  
  export default InputField;