import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import {
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  // TableCaption,
  TableContainer,
  Button,
  Select,
  Stack
} from "@chakra-ui/react";
import { useColorMode, useColorModeValue} from "@chakra-ui/react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function AdminTabel() {
  const [userData, setUserData] = useState([]);
  const [levelSelect, setLevelSelect] = useState();

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const toastDisplayed = useRef(false);

  const { colorMode } = useColorMode();
  const tulisanColor = useColorModeValue("rgba(var(--color-text))", "rgba(var(--color-text))");

  const [isDarkMode, setIsDarkMode] = useState(
    document.documentElement.getAttribute("data-theme") === "dark"
  );

  const fetchUser = async () => {
    let response = await axios.get("http://10.126.15.197:8002/part/alluser");
    setUserData(response.data);
  };

  const updateUser = async (id, data) => {
    let dataUser = { level: data };
    let response = await axios.patch(
      `http://10.126.15.197:8002/part/userupdate/${id}`,
      dataUser
    );
    if (response) {
      if (!toastDisplayed.current) {
        toast.success(response.data.message);
      }
      toastDisplayed.current = true;
    }
    fetchUser();
  };

  const deleteUser = async (id) => {
    let response = await axios.delete(
      `http://10.126.15.197:8002/part/userdelete/${id}`
    );
    if (response) {
      if (!toastDisplayed.current) {
        toast.success(response.data.message);
      }
      toastDisplayed.current = true;
    }
    fetchUser();
  };

  const editUser = async (id) => {
    let response = await axios.patch(
      `http://10.126.15.197:8002/part/useredit/${id}`
    );

    fetchUser();
  };

  const selectHendeler = (e) => {
    setLevelSelect(e.target.value);
  };
  const editHendeler = (id) => {
    editUser(id);
  };

  const updateHendeler = (id) => {
    updateUser(id, levelSelect);
    // console.log(`No id : ${id}, value: ${levelSelect}`);
  };
  const deleteHendeler = (id) => {
    deleteUser(id);
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };
  
  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, Math.ceil(userData.length / rowsPerPage)));
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

  useEffect(() => {
    fetchUser();
  }, []);

  useEffect(() => {
    // Reset toastDisplayed when changing pages
    toastDisplayed.current = false;
  }, [currentPage]);

  useEffect(() => {
    // Reset toastDisplayed when component mounts
    toastDisplayed.current = false;
  }, [userData]);


  const renderUserList = () => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const visibleData = userData.slice(startIndex, startIndex + rowsPerPage);

    if (userData.length === 0) {
      return (
        <Tr>
          <Td colSpan={10} className="text-center">
            No data available
          </Td>
        </Tr>
      );
    }
    return visibleData.map((users, index) => (
        <Tr key={index}>
          <Td>{users.id_users}</Td>
          <Td>{users.username}</Td>
          <Td>{users.name}</Td>
          <Td>{users.email}</Td>
          <Td>{users.password}</Td>
          <Td>
            {users.level === null ? (
              <Select placeholder="Select level" onChange={selectHendeler}>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </Select>
            ) : (
              users.level
            )}
          </Td>
          <Td>{users.isAdmin}</Td>
          <Td>
            {users.level === null ? (
              <Button
                colorScheme="blue"
                className="mx-1"
                onClick={() => {
                  updateHendeler(users.id_users);
                }}
              >
                Update
              </Button>
            ) : (
              <Button
                colorScheme="green"
                className="mx-1"
                onClick={() => {
                  editHendeler(users.id_users);
                }}
              >
                Edit
              </Button>
            )}
            <Button
              colorScheme="red"
              onClick={() => deleteHendeler(users.id_users)}
            >
              Delete
            </Button>
          </Td>
        </Tr>
      )
    );
  };

  return (
    <>
      <div>
        <h1 className="text-center text-text text-3xl font-bold ">Users Tabel</h1>
      </div>
      <Stack className="flex flex-row justify-center gap-2"
        direction="row"
        spacing={2}
        align="center">
        <div className="mt-2">
          <Select
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(Number(e.target.value))}
            width="80px">
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={40}>40</option>
            <option value={60}>60</option>
            <option value={100}>100</option>
          </Select>
        </div>
      </Stack>
      <br />
      <TableContainer className="bg-card rounded-md  ">
        <Table key={colorMode} variant="simple">
          <Thead>
            <Tr>
              <Th sx={{
              color: tulisanColor,
              }}>id</Th>
              <Th sx={{
              color: tulisanColor,
              }}>Initial Name</Th>
              <Th sx={{
              color: tulisanColor,
              }}>Name</Th>
              <Th sx={{
              color: tulisanColor,
              }}>Email</Th>
              <Th sx={{
              color: tulisanColor,
              }}>Password (* hashing by Bcrypt)</Th>
              <Th sx={{
              color: tulisanColor,
              }}>level</Th>
              <Th sx={{
              color: tulisanColor,
              }}>Super Admin</Th>
              <Th sx={{
              color: tulisanColor,
              }}>Action</Th>
            </Tr>
          </Thead>
          <Tbody>{renderUserList()}</Tbody>
        </Table>
      </TableContainer>
      {/* Pagination Controls */}
      <div className="flex justify-center items-center mt-4 gap-4 mb-2">
        <Button
          onClick={handlePrevPage}
          isDisabled={currentPage === 1}
          colorScheme="blue"
        >
          Previous
        </Button>
        <span className="text-text">
          Page {currentPage} of {Math.ceil(userData.length / rowsPerPage)}
        </span>
        <Button
          onClick={handleNextPage}
          isDisabled={currentPage === Math.ceil(userData.length / rowsPerPage)}
          colorScheme="blue"
        >
          Next
        </Button>
      </div>  

      <ToastContainer position="top-center" draggable autoClose={3000}/>    
    </>
  );
}

export default AdminTabel;
