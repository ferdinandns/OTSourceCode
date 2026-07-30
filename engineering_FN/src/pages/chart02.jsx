import React from 'react'

const chart02 = () => {
    
  return (
    <div className="col-span-12 rounded-md border border-stroke shadow-buatcard bg-coba p-7.5 dark:border-strokedark xl:col-span-6">
      <div className="mb-4 justify-between gap-4 sm:flex">
        <div>
          <h4 className="text-xl font-semibold text-text">
            Profit this week
          </h4>
        </div>
        </div>
        {/* Embed iframe */}
      <div className="mt-4">
        <iframe
          src="https://snapshots.raintank.io/dashboard/snapshot/jrOsrw3oOzY8dUZ4nebvAvriZRtoNl7j?orgId=0&from=now-30d&to=now"
          width="540"
          height="200"
          style={{
            border: 'none', // Removes border
          }}
          title="Grafana Chart"
        ></iframe>
      </div>
    </div>

  )
}

export default chart02