import { create } from 'zustand';
import api from '../services/account-api';

/** Who is logged in (`user` is `{ username }`, or null). `loaded` is false until the first check. */
const useAccount = create((set) => ({
  user: null,
  loaded: false,
  setUser: (user) => set({ user, loaded: true }),
  refresh: () =>
    api
      .me()
      .then((user) => set({ user, loaded: true }))
      .catch(() => set({ user: null, loaded: true })),
}));

export default useAccount;
