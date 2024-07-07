
// Mocking the database client
import EventService from "../sameTime/EventService";
import database from "../client/database";

jest.mock('../client/database', () => {
    return {
        events: {
            findUnique: jest.fn(),
            update: jest.fn()
        }
    };
})

describe("이벤트 서비스단을 테스트합니다.", () => {
    let eventService: EventService;

    beforeEach(() => {
        eventService = new EventService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("남은 자리가 없으면 에러를 반환합니다.", async () => {
        (database.events.findUnique as jest.Mock).mockResolvedValue({
            id: 1,
            name: "테스트 이벤트",
            remaining_slots: 0
        });

        await expect(eventService.initEvent(1, 1)).rejects.toThrow("남은 자리가 없습니다.");
    });

    test("만약 남은 자리가 있다면, 유저를 추가합니다.", async () => {
        (database.events.findUnique as jest.Mock).mockResolvedValue({
            id: 1,
            name: "테스트 이벤트",
            remaining_slots: 5
        });

        (database.events.update as jest.Mock).mockResolvedValue({
            id: 1,
            name: "테스트 이벤트",
            remaining_slots: 4
        });

        await eventService.initEvent(1, 1);

        expect(database.events.findUnique).toHaveBeenCalledWith({
            where: {
                id: 1
            }
        });

        expect(database.events.update).toHaveBeenCalledWith({
            where: {
                id: 1
            },
            data: {
                remaining_slots: 4,
                event_participants: {
                    create: {
                        user_id: 1
                    }
                }
            }
        });
    });
    test("should handle concurrency issue", async () => {
        const mockFindUnique = database.events.findUnique as jest.Mock;
        const mockUpdate = database.events.update as jest.Mock;

        mockFindUnique.mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return { id: 1, name: "Test Event", remaining_slots: 1 };
        });

        let updateCount = 0;
        mockUpdate.mockImplementation(async (args) => {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (updateCount >= 1) {
                throw new Error("Concurrency issue: no slots available");
            }
            updateCount += 1;
            return { ...args.data, id: 1, name: "Test Event" };
        });

        const promises = [
            eventService.initEvent(1, 1),
            eventService.initEvent(1, 2)
        ];

        const results = await Promise.allSettled(promises);

        expect(mockUpdate).toHaveBeenCalledTimes(2);

        const successfulUpdates = results.filter(result => result.status === "fulfilled");
        const failedUpdates = results.filter(result => result.status === "rejected");

        expect(successfulUpdates.length).toBe(1);
        expect(failedUpdates.length).toBe(1);
    });
});