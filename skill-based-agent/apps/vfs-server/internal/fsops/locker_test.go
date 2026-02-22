package fsops

import (
	"sync"
	"sync/atomic"
	"testing"
)

func TestUserLockerConcurrentReads(t *testing.T) {
	ul := NewUserLocker()
	var wg sync.WaitGroup
	var active int64

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ul.RLock("user1")
			defer ul.RUnlock("user1")
			atomic.AddInt64(&active, 1)
			// All goroutines should be able to hold the read lock concurrently
			defer atomic.AddInt64(&active, -1)
		}()
	}
	wg.Wait()
}

func TestUserLockerExclusiveWrite(t *testing.T) {
	ul := NewUserLocker()
	var wg sync.WaitGroup
	counter := 0

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ul.Lock("user1")
			defer ul.Unlock("user1")
			counter++
		}()
	}
	wg.Wait()

	if counter != 100 {
		t.Errorf("expected counter=100, got %d", counter)
	}
}

func TestUserLockerIsolation(t *testing.T) {
	ul := NewUserLocker()

	// Different users should have independent locks
	done := make(chan struct{})
	ul.Lock("user1")

	go func() {
		// user2 lock should not be blocked by user1 lock
		ul.Lock("user2")
		ul.Unlock("user2")
		close(done)
	}()

	<-done
	ul.Unlock("user1")
}
