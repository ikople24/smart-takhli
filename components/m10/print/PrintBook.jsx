import CoverSheet from "./CoverSheet";
import SectionDivider from "./SectionDivider";
import WorkSheet from "./WorkSheet";

export default function PrintBook({ book }) {
  return (
    <div className="m10p-book">
      <CoverSheet book={book} />
      {book.sections.map((section) => (
        <div key={`${section.docType}-${section.changeType}`}>
          <SectionDivider
            section={section}
            firstSheetNo={section.sheets[0]?.sheetNo ?? 0}
            lastSheetNo={section.sheets[section.sheets.length - 1]?.sheetNo ?? 0}
          />
          {section.sheets.map((sheet) => (
            <WorkSheet key={sheet.txnId} sheet={sheet} sectionLabel={section.changeTypeLabel} />
          ))}
        </div>
      ))}
    </div>
  );
}
