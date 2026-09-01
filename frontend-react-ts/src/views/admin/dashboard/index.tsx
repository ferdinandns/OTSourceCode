//import FC from react
import { FC } from "react";

//import SidebarMenu
import SidebarMenu from '../../../components/SidebarMenu';

//import custom hook useAuthUser
import { useAuthUser } from '../../../hooks/auth/useAuthUser';

const Dashboard: FC = () => {

    // get user from useAuthUser
    const user = useAuthUser();

    return (
        <>
            {/* Horizontal Menu - Full Width */}
            <SidebarMenu isHorizontal={true} />
            
            {/* Dashboard Content */}
            <div className="container mt-4 mb-5">
                <div className="row">
                    <div className="col-12">
                        <div className="card border-0 rounded-4 shadow-sm">
                            <div className="card-header">
                                DASHBOARD
                            </div>
                            <div className="card-body">
                                {user ? (
                                    <p>Selamat datang, <strong>{user.name}</strong>!</p>
                                ) : (
                                    <p>Kamu belum login.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}

export default Dashboard