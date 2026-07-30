import { useEffect } from "react";
import { useParams } from "react-router";
import { useState } from "react";
import { Select, Input } from "@chakra-ui/react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import moment from "moment/moment";
import { getDataById } from "../features/part/partSlice";
import { editePartListData } from "../features/part/partSlice";

function CreateEdit() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const partId = useSelector((state) => state.part.partId);
  const tanggal = moment(partId.Tanggal).format("MM/MM/YYYY");

  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute("data-theme") === "dark"
  );

  useEffect(() => {
    dispatch(getDataById(id, tanggal));
  }, []);

  useEffect(() => {
    setNewLine(partId.Line);
    setNewMachine(partId.Mesin);
    setNewJob(partId.Pekerjaan);
    setNewJobDetail(partId.Detail);
    setNewDate(tanggal);
    setNewQuantity(partId.Quantity);
    setNewUnit(partId.Unit);
    setNewPIC(partId.Pic);
    setNewStartTime(partId.Tawal);
    setNewFinishTime(partId.Tahir);
  }, [partId]);

  const [dataList, setDataList] = useState({});
  const [newLine, setNewLine] = useState("");
  const [newMachine, setNewMachine] = useState("");
  const [newJob, setNewJob] = useState("");
  const [newJobDetail, setNewJobDetail] = useState("");
  const [newDate, setNewDate] = useState();
  const [newQuantity, setNewQuantity] = useState();
  const [newUnit, setNewUnit] = useState("");
  const [newPIC, setNewPIC] = useState("");
  const [newStartTime, setNewStartTime] = useState();
  const [newFinishTime, setNewFinishTime] = useState();

  if (newStartTime && newFinishTime) {
    var hm = newStartTime;
    var a = hm.split(":");
    var minutes = +a[0] * 60 + +a[1];

    var hm2 = newFinishTime;
    var a2 = hm2.split(":");
    var minutes2 = +a2[0] * 60 + +a2[1];
    var totalMinuites = minutes2 - minutes;
  } else {
    var totalMinuites = 0;
  }

  const editData = () => {
    let tempData = {
      Mesin: newMachine,
      Line: newLine,
      Pekerjaan: newJob,
      Detail: newJobDetail,
      Tanggal: newDate,
      Quantity: newQuantity,
      Unit: newUnit,
      Pic: newPIC,
      Tawal: newStartTime,
      Tahir: newFinishTime,
      Total: totalMinuites,
    };
    setDataList((dataList, { ...tempData }));
    dispatch(editePartListData(tempData, id));
    alert("Data berhasil edit");
    navigate("/Maintenance");
  };

  const lineHendeler = (event) => {
    setNewLine(event.target.value);
  };
  const machineHendeler = (event) => {
    setNewMachine(event.target.value);
  };
  const jobHendeler = (event) => {
    setNewJob(event.target.value);
  };
  const jobDetailHendeler = (event) => {
    setNewJobDetail(event.target.value);
  };
  const dateHendeler = (event) => {
    setNewDate(event.target.value);
  };
  const quantityHendeler = (event) => {
    setNewQuantity(event.target.value);
  };
  const unitHendeler = (event) => {
    setNewUnit(event.target.value);
  };
  const PICHendeler = (event) => {
    setNewPIC(event.target.value);
  };
  const startTimeHendeler = (even) => {
    setNewStartTime(even.target.value);
  };
  const finishTimeHendeler = (even) => {
    setNewFinishTime(even.target.value);
  };

  useEffect(() => {
    const handleThemeChange = () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      setIsDarkMode(currentTheme === 'dark');
    };
    // Observe attribute changes
    const observer = new MutationObserver(handleThemeChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => observer.disconnect();
  }, []);

  return (
    <div>
      <div className="px-4 sm:px-6 md:px-8 lg:px-16 xl:px-24 py-6 max-w-7xl mx-auto">
        <div className="space-y-8 ">
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-xl font-bold text-text sm:text-2xl mt-6">
              EDIT DATA MAINTENANCE {id}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label
                  htmlFor="line"
                  className="block text-sm font-medium leading-6 text-text" 
                >
                  Line Area
                </label>
                <Select
                  id="line"
                  className="block w-full rounded-md border border-gray-300 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  onChange={lineHendeler}
                  value={newLine}
                >
                  <option value="" disabled>Select Line</option>
                  <option value="Line1">Line 1</option>
                  <option value="Line2">Line 2</option>
                  <option value="Line3">Line 3</option>
                  <option value="Line4">Line 4</option>
                </Select>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="machine"
                  className="block text-sm font-medium leading-6 text-text"
                >
                  Machine
                </label>
                <Select
                  className="block w-full rounded-md border border-gray-300 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  onChange={machineHendeler}
                  value={newMachine}
                >
                  <option value="" disabled>Select Machine</option>
                  <option value="PMA">PMA</option>
                  <option value="FBD">FBD</option>
                  <option value="EPH">EPH</option>
                  <option value="FinalMixing">Final MIxing</option>
                  <option value="Fette">Fette</option>
                  <option value="Coating">Coating</option>
                  <option value="Striping">Striping</option>
                  <option value="CM1">CM1</option>
                  <option value="Cm2">CM2</option>
                  <option value="CM3">CM3</option>
                  <option value="CM4">CM4</option>
                  <option value="CM5">CM5</option>
                  <option value="CC1">CC1</option>
                  <option value="CC2">CC2</option>
                </Select>
              </div>

              <div  className="space-y-2">
                <label
                  htmlFor="Pekerjaan"
                  className="block text-sm font-medium leading-6 text-text"
                >
                  Pekerjaan
                </label>
                  <input
                    onChange={jobHendeler}
                    id="Pekerjaan"
                    name="Pekerjaan"
                    type="Pekerjaan"
                    value={newJob}
                    autoComplete="Pekerjaan"
                    className="block w-full rounded-md border border-border bg-card text-text py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="tanggal"
                  className="block text-sm font-medium leading-6 text-text"
                >
                  Tanggal ({tanggal})
                </label>
                <div className="">
                  <Input
                    defaultValue={newDate}
                    value={newDate}
                    onChange={dateHendeler}
                    placeholder={newDate}
                    type="date"
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    css={{
                      "&::-webkit-calendar-picker-indicator": {
                        color: isDarkMode ? "white" : "black",
                        filter: isDarkMode ? "invert(1)" : "none",
                      },
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="Sparepart"
                  className="block text-sm font-medium leading-6 text-text"
                >
                  Sparepart Name
                </label>
                <input
                  id="sparepart"
                  type="text"
                  className="block w-full rounded-md border text-text bg-card border-border py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="Masukkan nama sparepart"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="Quantity"
                  className="block text-sm font-medium leading-6 text-text"
                >
                  Quantity
                </label>
                <div className="mt-2">
                  <Input
                    onChange={quantityHendeler}
                    value={newQuantity}
                    size="md"
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    type="number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="username"
                  className="block text-sm font-medium leading-6 text-text"
                >
                  Unit
                </label>
                <div>
                  <Select
                    onChange={unitHendeler}
                    className="block w-full rounded-md border border-gray-300 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    value={newUnit}
                  >
                    <option value="" disabled>Select Unit</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Rol">Rol</option>
                    <option value="Meter">Meter</option>
                    <option value="Cm">Cm</option>
                    <option value="Box">Box</option>
                    <option value="Lot">Lot</option>
                    <option value="Pack">Pack</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="pic"
                  className="block text-sm font-medium leading-6 text-text"
                >
                  PIC
                </label>
                <div>
                  <Select
                    onChange={PICHendeler}
                     className="block w-full rounded-md border border-gray-300 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    value={newPIC}
                  >
                    <option value="" disabled>Select PIC</option>
                    <option value="SGO">Sugino</option>
                    <option value="MKF">Khaerul</option>
                    <option value="RAO">Renaldo</option>
                    <option value="CKA">Chandra</option>
                    <option value="RDP">Ricy</option>
                    <option value="ARF">Arief</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="photo"
                  className="block text-sm font-medium leading-6 text-text"
                >
                  Awal Pengerjaan
                </label>
                <div className="mt-2 flex items-center gap-x-3">
                  <Input
                    value={newStartTime}
                    onChange={startTimeHendeler}
                    placeholder="Select Date and Time"
                    type="time"
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    css={{
                      "&::-webkit-calendar-picker-indicator": {
                        color: isDarkMode ? "white" : "black",
                        filter: isDarkMode ? "invert(1)" : "none",
                      },
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="photo"
                  className="block text-sm font-medium leading-6 text-text"
                >
                  Akhir Pengerjaan
                </label>
                <div className="mt-2 flex items-center gap-x-3">
                  <Input
                    value={newFinishTime}
                    onChange={finishTimeHendeler}
                    placeholder="Select Date and Time"
                    type="time"
                    className="block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                    css={{
                      "&::-webkit-calendar-picker-indicator": {
                        color: isDarkMode ? "white" : "black",
                        filter: isDarkMode ? "invert(1)" : "none",
                      },
                    }}
                  />
                </div>
              </div>
              {/* Detail Pekerjaan - Full Width */}
              <div className="space-y-2 md:col-span-2">
                <label htmlFor="detail" className="block text-sm font-medium text-text">
                  Detail Pekerjaan
                </label>
                <textarea
                  id="detail"
                  rows={4}
                  onChange={jobDetailHendeler}
                  value={newJobDetail}
                  className="block w-full rounded-md border border-border bg-card text-text py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                  placeholder="Masukkan detail pekerjaan"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-4 mt-8">
          <button
            type="button"
            className="mt-3 sm:mt-0 w-full sm:w-auto px-4 py-2 rounded-md shadow-sm text-sm font-medium text-text hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            onClick={() => navigate("/Maintenance")}
          >
            Cancel
          </button>
          <button
            onClick={() => editData()}
            className="w-full sm:w-auto px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default CreateEdit;
