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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 max-w-screen-xl mx-auto w-full">
          <div className="card bg-base-100 w-full h-[200px] shadow-sm flex flex-row overflow-hidden">
            <figure className="w-[60%] h-full">
              <img
                src="https://img.daisyui.com/images/stock/photo-1606107557195-0e29a4b5b4aa.webp"
                className="w-full h-full object-cover"
                alt="Shoes"
              />
            </figure>
            <div className="card-body w-[40%] p-4">
              <h2 className="card-title text-sm">
                Card Title
                <div className="badge badge-secondary">NEW</div>
              </h2>
              <p className="text-xs">
                A card component has a figure, a body part, and inside body there
                are title and actions parts
              </p>
              <div className="card-actions justify-end">
                <div className="badge badge-outline text-xs">Fashion</div>
                <div className="badge badge-outline text-xs">Products</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
