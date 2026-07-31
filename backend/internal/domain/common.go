package domain

type VerificationResult string

const (
	VerifyApproved VerificationResult = "APPROVE"
	VerifyRejected VerificationResult = "REJECT"
)

type Action string

const (
	RequestCreate Action = "REQUEST_CREATE"
	RequestEdit   Action = "REQUEST_EDIT"
	RequestDelete Action = "REQUEST_DELETE"
)

type ActionDesc string

const (
	// Create, Update, Delete
	RequestCreateDesc ActionDesc = "Tambah"
	RequestEditDesc   ActionDesc = "Ubah"
	RequestDeleteDesc ActionDesc = "Hapus"

	// Approval
	ApprovalApprove ActionDesc = "Menyetujui Request"
	ApprovalReject  ActionDesc = "Menolak Request"
)

type Model string

const (
	MenuSarprasType   Model = "Master Sarpras Type"
	MenuSarpras       Model = "Master Sarpras"
	MenuDepartemen    Model = "Master Department"
	MenuSite          Model = "Master Site"
	MenuUser          Model = "Master User"
	MenuApproval      Model = "Approval"
	MenuPemeriksaan   Model = "Pemeriksaan"
	MenuPerbaikan     Model = "Perbaikan"
	MenuReview        Model = "Verifikasi Perbaikan"
	MenuRefill        Model = "Refill ED"
	MenuRevieweRefill Model = "Verifikasi Refill ED"
)
