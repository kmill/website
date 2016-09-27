#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <pthread.h>

//#define BLOCK_SIZE 16384
//#define NUM_BLOCKS 64
#define BLOCK_SIZE 512
#define NUM_BLOCKS 4
#define NUM_THREADS 2

#define VIEW_WORKERS 1

#define DIGCHECK(a) a
//#define DIGCHECK(a)

/* gcc --std=c99 -O2 -o e e.c -lpthread */

typedef uint32_t spinlock_t;

uint64_t lock(volatile spinlock_t *l) {
  uint64_t waste = 0;
  while (__sync_lock_test_and_set(l, 1))
    do {
      __asm volatile("pause\n": : :"memory");
      waste++;
    } while (*l);
  return waste;
}
void unlock(volatile spinlock_t *l) {
  __sync_lock_release(l);
}

typedef struct {
  volatile spinlock_t lock;
  volatile uint64_t lock_waste;
  uint32_t digits[BLOCK_SIZE];
} bignum_block_t;

typedef struct {
  bignum_block_t blocks[NUM_BLOCKS];
} bignum_t;

void lock_block(volatile bignum_block_t *block) {
  uint64_t waste = lock(&block->lock);
  block->lock_waste += waste;
}
void unlock_block(volatile bignum_block_t *block) {
  unlock(&block->lock);
}

void bignum_clear(bignum_t *bignum, uint32_t ones) {
  for (int j = 0; j < NUM_BLOCKS; j++) {
    bignum->blocks[j].lock = 0;
    for (int i = 0; i < BLOCK_SIZE; i++) {
      bignum->blocks[j].digits[i] = 0;
    }
  }
  bignum->blocks[0].digits[0] = ones;
}

/*
void copy_bignum(uint32_t *bignum_dest, uint32_t *bignum_source, int length) {
  memcpy(bignum_dest, bignum_source, length * sizeof(uint32_t));
}
*/

void divide(bignum_t *bignum, uint32_t n) {
  uint32_t rem = 0;
  for (size_t j = 0; j < NUM_BLOCKS; j++) {
    bignum_block_t *block = &bignum->blocks[j];
    for (size_t i = 0; i < BLOCK_SIZE; i++) {
      uint64_t w = block->digits[i] | ((uint64_t)rem << 32);
      block->digits[i] = (uint32_t)(w / n);
      rem = (uint32_t)(w % n);
    }
  }
}

void sum_bignum(uint32_t dest[], uint32_t a[], uint32_t b[], int length) {
  uint32_t carry = 0;
  for (int i = length - 1; i >= 0; i--) {
    uint64_t s = (uint64_t)(a[i]) + (uint64_t)(b[i]) + carry;
    dest[i] = (uint32_t)s;
    carry = (uint32_t)(s >> 32);
  }
}
void diff_bignum(uint32_t dest[], uint32_t a[], uint32_t b[], int length) {
  uint32_t borrow = 0;
  for (int i = length - 1; i >= 0; i--) {
    uint64_t d = (((uint64_t)1 << 32) | (uint64_t)(a[i])) - (uint64_t)(b[i]) - borrow;
    dest[i] = (uint32_t)d;
    borrow = !(uint32_t)(d >> 32);
  }
}

void mul_100000(bignum_t *bignum) {
  uint32_t carry = 0;
  for (int32_t j = NUM_BLOCKS - 1; j >= 0; j--) {
    bignum_block_t *block = &bignum->blocks[j];
    for (int32_t i = BLOCK_SIZE - 1; i >= 0; i--) {
      uint32_t w = block->digits[i];
      uint64_t m = (uint64_t)w * 100000 + carry;
      block->digits[i] = (uint32_t)m;
      carry = (uint32_t)(m >> 32);
    }
  }
}

void print_five_digits(char * buffer, bignum_t *bignum) {
  mul_100000(bignum);
  sprintf(buffer, "%05d", bignum->blocks[0].digits[0]);
  bignum->blocks[0].digits[0] = 0;
}

void print_nine_digits(char * buffer, bignum_t *bignum) {
  uint32_t carry = 0;
  for (int32_t j = NUM_BLOCKS - 1; j >= 0; j--) {
    bignum_block_t *block = &bignum->blocks[j];
    for (int32_t i = BLOCK_SIZE - 1; i >= 0; i--) {
      uint32_t w = block->digits[i];
      uint64_t m = (uint64_t)w * 1000000000 + carry;
      block->digits[i] = (uint32_t)m;
      carry = (uint32_t)(m >> 32);
    }
  }
  printf("%u\n", bignum->blocks[0].digits[0]);
  printf("%u %u\n", carry);
}

void print_bignum(bignum_t *bignum) {
  int length = BLOCK_SIZE * NUM_BLOCKS;
  int n10dig = (int)(((length - 1) * 32) / 3.3219280948873626);
  printf("(%d base-10 digits, %d base-2 digits)\n", n10dig, 32*length);

  char buffer[10];
  printf("%d.", bignum->blocks[0].digits[0]);
  bignum->blocks[0].digits[0] = 0;
  for (size_t i = 0; i < n10dig;) {
    print_five_digits(buffer, bignum);
    if (n10dig - i < 5) {
      buffer[n10dig - i] = '\0';
      i = n10dig;
    } else {
      i += 5;
    }
    printf("%s", buffer);
    if (i % 10000 == 0) {
      printf("\n\n\n  ");
    } else if (i % 500 == 0) {
      printf("\n\n  ");
    } else if (i % 50 == 0) {
      printf("\n  ");
    } else if (i % 10 == 0) {
      printf("  ");
    } else if (i % 5 == 0) {
      printf(" ");
    }
  }
  printf("\n");
}

bignum_t num;

typedef struct {
  uint32_t thread_num;
  bignum_t *bignum;
} division_thread_t;

division_thread_t thread_data[NUM_THREADS];
volatile spinlock_t start_lock = 0;
volatile uint32_t next_n; // locked by blocks[0]

int ndig(int tdig, int bits) {
  int digs = tdig - ((bits - 2) * (1 << (bits - 1)) + 1);
  return digs > 0 ? digs : 0;
}

int ilog2(uint32_t n) {
  int i = 0;
  while (n >>= 1) i++;
  return i;
}

void *threadFunc(void *arg) {
  division_thread_t *data = (division_thread_t *)arg;
  bignum_t *bignum = data->bignum;

  lock_block(&bignum->blocks[0]);
  unlock(&start_lock);

  int count = 0;
  while (1) {
    uint32_t n = next_n;
    if (n < 2) break;
    next_n--;

    int digs = 0;
    DIGCHECK(digs = (31 + ndig(32 * NUM_BLOCKS * BLOCK_SIZE, ilog2(n)))/32);
    
    if (count % 1000 == 0) {
      if (VIEW_WORKERS) {
        int worker_count = 0;
        uint64_t waste = 0;
        if (data->thread_num == 0) {
          fprintf(stderr, "<");
          for (int k = 0; k < NUM_BLOCKS; k++) {
            waste += bignum->blocks[1].lock_waste;
            if (bignum->blocks[k].lock) worker_count++;
            fprintf(stderr, "%s%", bignum->blocks[k].lock ? "*" : " ");
          }
          fprintf(stderr, "> (%d workers)\n", worker_count);
          fprintf(stderr, "lock waste=%ldB\n", waste/1000000000);
        }
      }
      fprintf(stderr, "T%d n=%d digits=%d\n", data->thread_num, n, digs);
    }
    count++;
    uint32_t rem = 0;
    bignum_block_t *block = &bignum->blocks[0];
    //lock_block(block);
    for (size_t i = 0; i < BLOCK_SIZE; i++) {
      uint64_t w = block->digits[i] | ((uint64_t)rem << 32);
      block->digits[i] = (uint32_t)(w / n);
      rem = (uint32_t)(w % n);
    }
    DIGCHECK(digs -= BLOCK_SIZE);
    block->digits[0] += 1;
    for (size_t j = 1; j < NUM_BLOCKS DIGCHECK(&& digs > 0); j++) {
      lock_block(&bignum->blocks[j]);
      unlock_block(block);
      block = &bignum->blocks[j];
      for (size_t i = 0; i < BLOCK_SIZE; i++) {
        uint64_t w = block->digits[i] | ((uint64_t)rem << 32);
        block->digits[i] = (uint32_t)(w / n);
        rem = (uint32_t)(w % n);
      }
      DIGCHECK(digs -= BLOCK_SIZE);
    }
    lock_block(&bignum->blocks[0]);
    unlock_block(block);
  }

  unlock_block(&bignum->blocks[0]);

  return NULL;
}

int select_N(int ndig) {
  for (int j = 1; ; j++) {
    int sumlog2 = (j-1) * (1 << j) + 1;
    if (sumlog2 > 32 * ndig) {
      return 1 << j;
    }
  }
  exit(22);
}

int main() {
  int divisor;

  bignum_clear(&num, 1);

  int N = select_N(NUM_BLOCKS * BLOCK_SIZE);

  int n10dig = (int)(((BLOCK_SIZE * NUM_BLOCKS - 1) * 32) / 3.3219280948873626);
  fprintf(stderr, "NUM_THREADS=%d\nNUM_BLOCKS=%d\nBLOCK_SIZE=%d\nN=%d\n(base-10 digits: %d)\n",
          NUM_THREADS, NUM_BLOCKS, BLOCK_SIZE, N, n10dig);

  next_n = N;

  for (int i = 0; i < NUM_THREADS; i++) {
    thread_data[i].thread_num = i;
    thread_data[i].bignum = &num;
  }

  pthread_t threads[NUM_THREADS];
  for (int i = 0; i < NUM_THREADS; i++) {
    lock(&start_lock);
    pthread_create(&threads[i], NULL, threadFunc, &thread_data[i]);
  }
  for (int i = 0; i < NUM_THREADS; i++) {
    pthread_join(threads[i], NULL);
  }
  fprintf(stderr, "All threads completed.\n\n");

  num.blocks[0].digits[0] += 1;

  //print_bignum(&num);
  num.blocks[0].digits[0] = 0;
  print_nine_digits(NULL, &num);
}
