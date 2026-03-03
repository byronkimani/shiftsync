import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useSwapRequest() {
    const queryClient = useQueryClient();

    const onSuccess = () => {
        queryClient.invalidateQueries({ queryKey: ['swap-requests'] });
        queryClient.invalidateQueries({ queryKey: ['shifts'] });
    };

    const create = useMutation({ mutationFn: api.swaps.create, onSuccess });
    const accept = useMutation({ mutationFn: api.swaps.accept, onSuccess });
    const decline = useMutation({ mutationFn: api.swaps.decline, onSuccess });
    const withdraw = useMutation({ mutationFn: api.swaps.withdraw, onSuccess });
    const approve = useMutation({ mutationFn: api.swaps.approve, onSuccess });
    const reject = useMutation({ mutationFn: api.swaps.reject, onSuccess });

    return {
        create,
        accept,
        decline,
        withdraw,
        approve,
        reject
    };
}
