
const InstrumentHeader = ({ name }: { name: string }) => {
  return (
    <div className="p-3 bg-success text-white rounded mb-3">
      <h3 className="m-0">{name}</h3>
    </div>
  );
};

export default InstrumentHeader;
