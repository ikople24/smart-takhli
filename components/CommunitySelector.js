const communities  = [
    "สามล",
    "รจนา",
    "หัวเขาตาคลี",
    "สว่างวงษ์",
    "ตาคลีพัฒนา",
    "ตีคลี",
    "ทัพย์พิมาน",
    "ตาคลีใหญ่",
    "บ้านใหม่โพนทอง",
    "วิลาวัลย์",
    "โพธิ์งาม",
    "พุทธนิมิต",
    "ยศวิมล",
    "ศรีเทพ",
    "สังข์ทอง",
    "ศรีสวัสดิ์",
    "เขาใบไม้",
    "จันทร์เทวี",
    "รวมใจ",
    "ตลาดโพนทอง",
    "มาลัย",
    "สารภี"
  ];

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