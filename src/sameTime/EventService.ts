import database from "../client/database";

export default class EventService {
    initEvent = async (eventId: number, userId: number): Promise<void> => {
        const event = await database.events.findUnique({
            where: { id: eventId }
        });

        if (event == null || event.remaining_slots <= 0) {
            throw new Error("남은 자리가 없습니다.");
        }

        await database.events.update({
            where: { id: event.id },
            data: {
                remaining_slots: event.remaining_slots - 1,
                event_participants: {
                    create: { user_id: userId }
                }
            }
        });
    }

    initEventMVCC = async (eventId: number, userId: number): Promise<void> => {
        const event = await database.events.findUnique({
            where: { id: eventId }
        });

        if (event == null || event.remaining_slots <= 0) {
            throw new Error("남은 자리가 없습니다.");
        }

        const result = await database.events.updateMany({
            where: {
                id: event.id,
                version: event.version
            },
            data: {
                remaining_slots: event.remaining_slots - 1,
                version: { increment: 1 }
            }
        });

        if (result.count === 0) {
            throw new Error("동시성 문제가 발생했습니다. 다시 시도해주세요.");
        }

        await database.event_participants.create({
            data: {
                user_id: userId,
                events_id: eventId
            }
        });
    }
}
