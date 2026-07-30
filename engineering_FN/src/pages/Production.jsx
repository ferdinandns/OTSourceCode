import ProductionSummary from "./ProductionSummary";
import { useSelector } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import ProductionInput from "./ProductionInput";

function Production() {
  const userGlobal = useSelector((state) => state.user.user);
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab");

  const getTabIndex = useCallback(() => {
    switch (initialTab) {
      case "Input":
        return userGlobal.level >= 5 ? "Input" : "Prod";
      case "Prod":
      default:
        return "Prod";
    }
  }, [initialTab, userGlobal.level]);

  const [activeTab, setActiveTab] = useState(getTabIndex());

  useEffect(() => {
    setActiveTab(getTabIndex());
  }, [getTabIndex]);

  const renderTabContent = () => {
    switch (activeTab) {
      case "Prod":
        return <ProductionSummary />
      case "Input":
        return <ProductionInput />
      default:
        return <ProductionSummary />
    }
  };

  return (
    <div>
      <>
        {renderTabContent()}
      </>
    </div>
  );
}

export default Production;
