import ParticipantSchema from '@/models/participant.model';

export const createParticipants = async (
    participants: any[],
    creatorId: any,
    conversationId: any,
): Promise<any[] | null> => {
    const newParticipantIds = [];

    for (const participant of participants) {
        const newParticipant = await createParticipant(
            participant,
            conversationId,
            participant === creatorId ? 'creator' : 'member',
        );

        if (!newParticipant) {
            console.log('error create participant');
            return null; // Nếu bất kỳ participant nào không tạo được -> trả về null
        }

        newParticipantIds.push(newParticipant);
    }

    return newParticipantIds;
};

export const createParticipant = async (
    userId: any,
    conversationId: any,
    role: 'creator' | 'admin' | 'member' = 'member',
) => {
    const isExist = await ParticipantSchema.findOne({
        user: userId,
        conversationId,
    });

    if (isExist) {
        return null;
    }

    const newParticipant = await ParticipantSchema.create({
        user: userId,
        conversationId,
        role,
    });

    return newParticipant._id;
};
