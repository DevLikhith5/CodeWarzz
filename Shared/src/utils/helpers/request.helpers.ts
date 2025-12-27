import { AsyncLocalStorage } from "async_hooks";

type AsyncLocalStorageType = {
    correlationId: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<AsyncLocalStorageType>();


export const getCorrelationId = () => {
    const asyncStore = asyncLocalStorage.getStore();
    return asyncStore?.correlationId;
}
