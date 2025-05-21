const communities  = ['บ้านบ่อ','บ้านศาลา','บ้านแพะขวาง','บ้านน้ำแพร่','บ้านป่าจี้','บ้านแสนตอ','บ้านท่าไม้ลุง','บ้านแม่ขนิลใต้','บ้านน้ำบุ่น','บ้านเวียงดัง'];

const CommunitySelector = ({ selected, onSelect = () => {}, error }) => (
    <div className="mb-4">
      <div className="flex py-2 gap-2">
      <label className="block text-sm font-medium text-gray-800 mb-1">1.เลือกชุมชน</label>
      {error && <div className="text-red-500 text-sm ml-auto">{error}</div>}
      </div>
      <div className="flex flex-wrap gap-2">
        {communities.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onSelect(c)}
            className={`btn btn-sm rounded-full px-4 py-2 text-base font-medium ${
              selected === c
                ? 'bg-blue-500 text-white border-none'
                : 'bg-blue-100 text-blue-900 hover:bg-blue-200 border-none'
            } transition duration-200 min-w-[120px] max-w-full sm:w-auto`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
export default CommunitySelector