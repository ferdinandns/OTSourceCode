import Sidebar from "./Sidebar"
import Header from "./Header"
import Footer from "./Footer"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />

        <main className="flex-1 overflow-y-auto bg-gray-100 dark:bg-gray-800 transition-colors duration-300">
          {children}
          <Footer />
        </main>
      </div>
    </div>
  )
}