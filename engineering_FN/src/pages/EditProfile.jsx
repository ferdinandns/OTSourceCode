import React, { useEffect, useState, Component } from "react";
import { useSelector } from "react-redux";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import PersonIcon from '@mui/icons-material/Person';
import { IoIosMail } from "react-icons/io";
import { IoIosCall } from "react-icons/io";
import { FiEdit } from "react-icons/fi";
import { FiUpload } from "react-icons/fi";
import Breadcrumb from "../components/Breadcrumbs/Breadcrumb";
import Header from "../components/header";

function EditProfile() {
  const userGlobal = useSelector((state) => state.user.user);
  const [idData, setidData] = useState();
  const [file, setFile] = useState(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (userGlobal) {
      console.log("User ID:", userGlobal.id);
    }
  }, [userGlobal]);

  const onFileChange = (event) => {
    setFile(event.target.files[0]);
    let preview = document.getElementById("imagepreview");
    preview.src = URL.createObjectURL(event.target.files[0]);
  };

  const uploadImage = async () => {
    if (file) {
      const obj = { id: userGlobal.id };
      let formData = new FormData();
      formData.append("file", file);
      formData.append("data", JSON.stringify(obj));

      try {
        const response = await axios.post("http://10.126.15.197:8002/upload", formData);
        console.log("Upload Success:", response);
        alert("Image uploaded successfully!");
      } catch (error) {
        console.error("Upload Error:", error);
        alert("Image upload failed.");
      }
    } else {
      alert("Select an image first");
    }
  };

  const imageData = userGlobal.imagePath
    ? `http://10.126.15.197:8002${userGlobal.imagePath}`
    : "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png";

  return (
    <div>
      <div className="mx-auto max-w-screen-2xl p-4 md:p-6 2xl:p-10">
      <div className="mx-auto max-w-270">
        <Breadcrumb pageName="Settings" />

        <div className="grid grid-cols-5 gap-8">
          <div className="col-span-5 xl:col-span-3">
            <div className="rounded-sm border border-border bg-card shadow-default">
              <div className="border-b border-border2 py-4 px-7">
                <h3 className="font-medium text-text">
                  Personal Information
                </h3>
              </div>
              <div className="p-7">
                <form action="#">
                  <div className="mb-5.5 flex flex-col gap-5.5 sm:flex-row">
                    <div className="w-full sm:w-1/2">
                      <label
                        className="mb-2 block text-sm font-medium text-text"
                        htmlFor="fullName"
                      >
                        Full Name
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2">
                          <PersonIcon sx={{ fontsize: 25 }} alt="Orang"/>
                        </span>
                        <input
                          className="w-full rounded border border-border bg-background py-3 pl-12 pr-4.5 text-text focus:ring-blue-500 focus-visible:outline-none cursor-pointer"
                          type="text"
                          name="fullName"
                          id="fullName"
                          placeholder="Your Name...."
                          defaultValue={userGlobal.name}
                        />
                      </div>
                    </div>

                    {/* <div className="w-full sm:w-1/2">
                      <label
                        className="mb-3 block text-sm font-medium text-text"
                        htmlFor="phoneNumber"
                      >
                        Phone Number
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2">
                          <IoIosCall sx={{ fontsize: 25 }} alt="Orang"/>
                        </span>
                        <input
                          className="w-full rounded border border-border bg-background py-3 pl-11.5 pr-4.5 text-text focus:ring-blue-500 focus-visible:outline-none cursor-pointer"
                          type="text"
                          name="phoneNumber"
                          id="phoneNumber"
                          placeholder="+990 3343 7865"
                          defaultValue="+990 3343 7865"
                        />
                      </div>
                    </div> */}
                  </div>

                  <div className="mb-5.5">
                    <label
                      className="mb-2 mt-3 block text-sm font-medium text-text"
                      htmlFor="emailAddress"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2">
                        <IoIosMail sx={{ fontsize: 25 }} alt="mail"/>
                      </span>
                      <input
                        className="w-full rounded border border-border bg-background py-3 pl-12 pr-4.5 text-text focus:ring-blue-500 focus-visible:outline-none cursor-pointer"
                        type="email"
                        name="emailAddress"
                        id="emailAddress"
                        placeholder="Your Email...."
                        defaultValue={userGlobal.email}
                      />
                    </div>
                  </div>

                  <div className="mb-5.5">
                    <label
                      className="mb-2 mt-3 block text-sm font-medium text-text"
                      htmlFor="Username"
                    >
                      Username
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2">
                        <PersonIcon sx={{ fontsize: 25 }} alt="mail"/>
                      </span>
                      <input
                        className="w-full rounded border border-border bg-background py-3 pl-12 pr-4.5 text-text focus:ring-blue-500 focus-visible:outline-none cursor-pointer"
                        type="text"
                        name="Username"
                        id="Username"
                        placeholder="Your Username....."
                        defaultValue={userGlobal.name}
                      />
                    </div>
                  </div>

                  <div className="mb-5.5">
                    <label
                      className="mb-2 mt-3 block text-sm font-medium text-text"
                      htmlFor="Username"
                    >
                      BIO
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-4">
                        <FiEdit sx={{ fontsize: 25 }} alt="edit" />
                      </span>

                      <textarea
                        className="w-full rounded border border-border bg-background py-3 pl-12 pr-4.5 text-text focus:ring-blue-500 focus-visible:outline-none cursor-pointer"
                        name="bio"
                        id="bio"
                        rows={6}
                        placeholder="Write your bio here"
                        defaultValue="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque posuere fermentum urna, eu condimentum mauris tempus ut. Donec fermentum blandit aliquet."
                      ></textarea>
                    </div>
                  </div>

                  <div className="flex justify-end gap-4">
                    <button
                      type="button"
                      className="text-sm font-semibold leading-6 text-text"
                      onClick={() => navigate(0)}>
                    Cancel</button>
                    <button
                      // onClick={() => updateHandeler()}
                      className="rounded-md bg-cta hover:bg-ctactive py-2 px-3 text-sm font-semibold text-white shadow-sm">
                    Save</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          {/* -------------------------------------------------------------------------------------------------------------------------------- */}
          <div className="col-span-5 xl:col-span-2">
            <div className="rounded-sm border border-border bg-card shadow-default">
              <div className="border-b border-border2 py-4 px-7">
                <h3 className="font-medium text-text">
                  Your Photo
                </h3>
              </div>
              <div className="p-7">
                <form action="#">
                  <div className="mb-4 flex items-center gap-3">
                    <div>
                      <img className="h-16 w-16 rounded-full ring-2 ring-red" src={imageData} id="imagepreview" alt="User" />
                    </div>
                    <div>
                      <span className="mb-1.5 text-text text-xl font-medium">
                        Edit your photo
                      </span>
                      <span className="flex gap-2.5 mt-1">
                        <button className="text-sm hover:text-blue-600">
                          Delete
                        </button>
                        <button className="text-sm hover:text-blue-600">
                          Update
                        </button>
                      </span>
                    </div>
                  </div>

                  <div
                    id="FileUpload"
                    className="relative mb-5.5 block w-full cursor-pointer appearance-none rounded border border-dashed border-blue-800 bg-background py-4 px-4 sm:py-7.5"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 z-50 m-0 h-full w-full cursor-pointer p-0 opacity-0 outline-none"
                      onChange={onFileChange}
                    />
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background">
                        <FiUpload sx={{ fontsize: 25 }} alt="upload" />
                      </span>
                      <p className="text-text">
                        <span className="text-blue-600">Click to upload</span> or
                        drag and drop
                      </p>
                      <p className="mt-1.5 text-text">SVG, PNG, JPG or GIF</p>
                      {/* <p className="text-text">(max, 800 X 800px)</p> */}
                    </div>
                  </div>

                  <div className="flex justify-end gap-4 mt-2">
                    <button
                        type="button"
                        className="text-sm font-semibold leading-6 text-text"
                        onClick={() => navigate(0)}>
                      Cancel</button>
                      <button
                        type="button"
                        onClick={uploadImage}
                        className="rounded-md bg-cta hover:bg-ctactive py-2 px-3 text-sm font-semibold text-white shadow-sm">
                      Save</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export default EditProfile;
