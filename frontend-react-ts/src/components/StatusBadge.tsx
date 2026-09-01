interface StatusBadgeProps {
  status: string
  hasReread?: boolean
  parentUsageId?: number | null
  size?: "sm" | "md"
}

export const StatusBadge = ({
  status,
  hasReread = false,
  parentUsageId = null,
  size = "md",
}: StatusBadgeProps) => {
  const isSmall = size === "sm"
  const baseClass = `badge ${isSmall ? "fs-xs" : ""}`

  // Ini adalah row re-read child (bukan parent)
  if (parentUsageId) {
    return (
      <span className={`${baseClass} bg-info text-white`}>
        <i className="bi bi-arrow-repeat me-1"></i>
        Re-read
      </span>
    )
  }

  switch (status) {
    case "Done Read":
      // Done Read + pernah ada re-read → badge kuning/warning
      if (hasReread) {
        return (
          <span className={`${baseClass} bg-warning text-dark`}>
            <i className="bi bi-arrow-clockwise me-1"></i>
            Done Read
            <span
              className="ms-1 badge bg-dark bg-opacity-25 text-dark"
              style={{ fontSize: "0.7em" }}
            >
              +re-read
            </span>
          </span>
        )
      }
      // Done Read biasa → hijau
      return (
        <span className={`${baseClass} bg-success`}>
          <i className="bi bi-check-circle me-1"></i>
          Done Read
        </span>
      )

    case "Re-read":
      return (
        <span className={`${baseClass} bg-warning text-dark`}>
          <i className="bi bi-hourglass-split me-1"></i>
          Re-read
        </span>
      )

    case "Read Process":
      return (
        <span className={`${baseClass} bg-primary`}>
          <i className="bi bi-activity me-1"></i>
          Read Process
        </span>
      )

    case "Failed":
      return (
        <span className={`${baseClass} bg-danger`}>
          <i className="bi bi-x-circle me-1"></i>
          Failed
        </span>
      )

    case "Rejected":
      return (
        <span className={`${baseClass} bg-danger`}>
          <i className="bi bi-slash-circle me-1"></i>
          Rejected
        </span>
      )

    default:
      return (
        <span className={`${baseClass} bg-secondary`}>
          {status || "-"}
        </span>
      )
  }
}