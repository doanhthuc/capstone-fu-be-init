export type DeleteType = {
    deletedCount: number;
};

export type EventPayload = {
    event: string;
    data: any;
};

export type RPCPayload = {
    type: string;
    data: any;
};
