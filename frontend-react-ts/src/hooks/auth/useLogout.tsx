import { useContext } from "react";
import { AuthContext } from "../../context/AuthContext";

export const useLogout = () => {
    const auth = useContext(AuthContext);

    return () => {
        auth?.logout();
    };
};
