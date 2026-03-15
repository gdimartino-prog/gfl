import MaintenanceClient from "@/components/MaintenanceClient";
import { isAdmin } from "@/lib/auth";
import { auth } from "@/auth";

const MaintenancePage = async () => {
  const admin = await isAdmin();
  if (!admin) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4 text-red-500">Unauthorized</h1>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const session = await auth();
  const isSuperuser = session?.user?.role === 'superuser';

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Commissioner</h1>
      <MaintenanceClient isSuperuser={isSuperuser} />
    </div>
  );
};

export default MaintenancePage;
