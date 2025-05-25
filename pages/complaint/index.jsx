import Head from "next/head";
export default function ComplaintListPage() {
  const complaints = [
    {
      id: 1,
      fullName: "พานุพงษ์ วงกระจาย",
      community: "บ้านท่าไม้ลุง",
      detail: "ถนนเป็นหลุมเยอะมาก",
      problems: ["ผิวจราจรเป็นหลุม"],
      images: ["https://res.cloudinary.com/demo/image/upload/sample.jpg"],
      timestamp: "2025-05-21T18:52:29.648Z",
    },
  ];
  return (
    <>
      <Head>
        <title>Smart-Namphare</title>
      </Head>
      <div className="w-full flex justify-center px-4 py-6 min-h-[750px] mx-auto">
        <div className="grid grid-cols-1 gap-4 max-w-screen-xl mx-auto w-full">
          {complaints.map((item) => (
            <div key={item.id} className="card bg-base-100 w-full h-[200px] shadow-sm flex flex-row overflow-hidden">
              <figure className="w-[60%] h-full">
                <img
                  src={item.images[0]}
                  className="w-full h-full object-cover"
                  alt={item.detail}
                />
              </figure>
              <div className="card-body w-[40%] p-4">
                <h2 className="card-title text-sm">
                  {item.fullName}
                  <div className="badge badge-secondary">{item.community}</div>
                </h2>
                <p className="text-xs">{item.detail}</p>
                <div className="card-actions justify-end flex-wrap">
                  {item.problems.map((prob, idx) => (
                    <div key={idx} className="badge badge-outline text-xs">{prob}</div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
