import EventService from "../sameTime/EventService";
import database from "../client/database";

jest.mock('../client/database', () => {
    return {
        events: {
            findUnique: jest.fn(),
            update: jest.fn(),
            updateMany: jest.fn() // Ensure updateMany is mocked
        },
        event_participants: {
            create: jest.fn()
        }
    };
});

describe("이벤트 서비스단 MVCC를 테스트합니다.", () => {
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
            name: "Test Event",
            remaining_slots: 0,
            version: 1
        });

        await expect(eventService.initEventMVCC(1, 1)).rejects.toThrow("남은 자리가 없습니다.");
    });

    test("만약 자리가 남아있다면, 유저를 추가합니다.", async () => {
        (database.events.findUnique as jest.Mock).mockResolvedValue({
            id: 1,
            name: "Test Event",
            remaining_slots: 5,
            version: 1
        });

        (database.events.updateMany as jest.Mock).mockResolvedValue({
            count: 1
        });

        await eventService.initEventMVCC(1, 1);

        expect(database.events.findUnique).toHaveBeenCalledWith({
            where: { id: 1 }
        });

        expect(database.events.updateMany).toHaveBeenCalledWith({
            where: {
                id: 1,
                version: 1
            },
            data: {
                remaining_slots: 4,
                version: { increment: 1 }
            }
        });

        expect(database.event_participants.create).toHaveBeenCalledWith({
            data: {
                user_id: 1,
                events_id: 1
            }
        });
    });

    test("version을 사용해서 동시성 문제가 발생하는 것을 테스트 합니다.", async () => {
        const mockFindUnique = database.events.findUnique as jest.Mock;
        const mockUpdateMany = database.events.updateMany as jest.Mock;
        const mockCreateParticipant = database.event_participants.create as jest.Mock;

        mockFindUnique.mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return { id: 1, name: "Test Event", remaining_slots: 1, version: 1 };
        });

        let updateCallCount = 0;
        mockUpdateMany.mockImplementation(async (args) => {
            await new Promise(resolve => setTimeout(resolve, 100));
            if (updateCallCount > 0 || args.where.version !== 1) {
                return { count: 0 };
            }
            updateCallCount++;
            return { count: 1 };
        });

        mockCreateParticipant.mockResolvedValue({
            id: 1,
            user_id: 1,
            events_id: 1
        });

        const promises = [
            eventService.initEventMVCC(1, 1),
            eventService.initEventMVCC(1, 2)
        ];

        const results = await Promise.allSettled(promises);

        expect(mockUpdateMany).toHaveBeenCalledTimes(2);

        const successfulUpdates = results.filter(result => result.status === "fulfilled");
        const failedUpdates = results.filter(result => result.status === "rejected");

        expect(successfulUpdates.length).toBe(1);
        expect(failedUpdates.length).toBe(1);
    });
});
