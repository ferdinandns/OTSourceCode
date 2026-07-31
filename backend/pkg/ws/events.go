package ws

const (
	EventNewNotification = "NEW_NOTIFICATION"
	EventDataUpdated     = "DATA_UPDATED"
)

func BroadcastDataUpdated(entity string) {
	GlobalHub.Broadcast(EventDataUpdated, map[string]string{
		"entity": entity,
	})
}
