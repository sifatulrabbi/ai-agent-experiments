package fsops

import "sync"

// UserLocker provides per-user RWMutex locking. Read operations use RLock
// for concurrent access; write operations use Lock for exclusive access.
type UserLocker struct {
	mu    sync.Mutex
	locks map[string]*sync.RWMutex
}

func NewUserLocker() *UserLocker {
	return &UserLocker{
		locks: make(map[string]*sync.RWMutex),
	}
}

func (ul *UserLocker) getLock(userID string) *sync.RWMutex {
	ul.mu.Lock()
	defer ul.mu.Unlock()
	rw, ok := ul.locks[userID]
	if !ok {
		rw = &sync.RWMutex{}
		ul.locks[userID] = rw
	}
	return rw
}

func (ul *UserLocker) RLock(userID string)   { ul.getLock(userID).RLock() }
func (ul *UserLocker) RUnlock(userID string) { ul.getLock(userID).RUnlock() }
func (ul *UserLocker) Lock(userID string)    { ul.getLock(userID).Lock() }
func (ul *UserLocker) Unlock(userID string)  { ul.getLock(userID).Unlock() }
