import database from "../client/database";

export default class EventService {
    initEvent = async (eventId : number, userId : number) : Promise<void> => {
        const event = await database.events.findUnique({
            where: {
                id: eventId
            }
        });

        if(event == null || event.remaining_slots <= 0) {
            throw new Error("남은 자리가 없습니다.");
        }

        await new Promise(time => setTimeout(time, 1000));

        await database.events.update({
            where :{
                id: event.id
            },
            data : {
                remaining_slots : event.remaining_slots - 1,
                event_participants : {
                    create : {
                        user_id : userId
                    }
                }
            }
        })
    }
}