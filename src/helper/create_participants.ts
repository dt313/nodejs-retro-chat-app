import ParticipantSchema from '@/models/participant.model';

export const createParticipants = async (participants: any) => {
    const newParticipants = await Promise.all(
        participants.map(async (participant: any) => {
            const newParticipant = await ParticipantSchema.create({
                userId: participant,
                role: 'member',
            });
            return newParticipant.userId;
        }),
    );
    return newParticipants;
};

export const createParticipantsForGroup = async (participants: any, creatorId: any) => {
    const newParticipants = await Promise.all(
        participants.map(async (participant: any) => {
            const newParticipant = await ParticipantSchema.create({
                userId: participant,
                role: participant === creatorId ? 'creator' : 'member',
            });
            return newParticipant.userId;
        }),
    );
    return newParticipants;
};
