// zero.c
// approximates 0 by (1/2)^n as n -> infty

/* gcc --std=gnu99 -O2 -o zero zero.c */

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>

//#define N32DIG 131072
//#define N32DIG 65536
#define N32DIG 10

uint32_t * powers;

void clear(uint32_t bignum[], int length, uint32_t ones) {
  bignum[0] = ones;
  for (int i = 1; i < length; i++) {
    bignum[i] = 0;
  }
}

void copy_bignum(uint32_t bignum_dest[], uint32_t bignum_source[], int length) {
  memcpy(bignum_dest, bignum_source, length * sizeof(uint32_t));
}

int divide(uint32_t dest[], uint32_t bignum[], int length, uint32_t n) {
  uint32_t rem = 0;
  int is_zero = 1;
  for (size_t i = 0; i < length; i++) {
    uint64_t w = bignum[i] | ((uint64_t)rem << 32);
    dest[i] = (uint32_t)(w / n);
    rem = (uint32_t)(w % n);
    is_zero &= dest[i] == 0;
  }
  return is_zero;
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

void mul_100000(uint32_t bignum[], int length) {
  uint32_t carry = 0;
  for (int32_t i = length - 1; i >= 0; i--) {
    uint32_t w = bignum[i];
    uint64_t m = (uint64_t)w * 100000 + carry;
    bignum[i] = (uint32_t)m;
    carry = (uint32_t)(m >> 32);
  }
}

void print_five_digits(char * buffer, uint32_t bignum[], int length) {
  mul_100000(bignum, length);
  sprintf(buffer, "%05d", bignum[0]);
  bignum[0] = 0;
}

void print_bignum(uint32_t bignum[], int length) {
  int n10dig = (int)(((length - 1) * 32) / 3.3219280948873626);
  printf("(%d base-10 digits, %d base-2 digits)\n", n10dig, 32*length);

  char buffer[10];
  printf("%d.", bignum[0]);
  bignum[0] = 0;
  for (size_t i = 0; i < n10dig;) {
    print_five_digits(buffer, bignum, length);
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

void temp_print(uint32_t bignum[], int length) {
  uint32_t *cbignum = malloc(length * sizeof(bignum));
  copy_bignum(cbignum, bignum, length);
  print_bignum(cbignum, length);
  free(cbignum);
}

void temp_hexprint(uint32_t bignum[], int length) {
  printf("%x.", bignum[0]);
  for (int i = 1; i < length; i++) {
    printf("%08x ", bignum[i]);
  }
  printf("\n");
}

int main(int argc, char **argv) {
  int usage = 0;
  int digits = N32DIG;

  int c;
  char *endptr;

  while ((c = getopt(argc, argv, "hn:")) != -1) {
    switch (c)
      {
      case 'h':
        usage = 1;
        break;
      case 'n' :
        digits = strtol(optarg, &endptr, 10);
        if (errno == ERANGE || *endptr != '\0') {
          fprintf(stderr, "Option -n requires a number.\n");
          usage = 2;
          goto optleave;
        }
        break;
      case '?' :
        usage = 2;
        goto optleave;
      default :
        usage = 2;
        goto optleave;
      }
  }
 optleave:
  if (digits < 0) {
    usage = 2;
  }
  if (usage) {
    fprintf(stderr, "Usage: zero -n [numdigits]\n");
    fprintf(stderr, "Computes digits of 0 using the approximation lim_{n -> infty} (1/2)^n.\n");
    fprintf(stderr, "  -n numdigits    sets the number of base-2^32 digits to compute\n");
    fprintf(stderr, "  -h              print this usage information\n");
    exit(usage == 1 ? 0 : usage);
  }

  int n10dig = (int)(((digits - 1) * 32) / 3.3219280948873626);
  fprintf(stderr, "Computing %d base-2^32 digits (%d base-10 digits).\n", digits, n10dig);

  powers = malloc(digits * sizeof(uint32_t));
  
  clear(powers, digits, 1);
  for (int i = 0; i < 32 * digits; i++) {
    divide(powers, powers, digits, 2);
    if (i % 1000 == 0) {
      fprintf(stderr, "divided %d times\n", i);
    }
  }
  fprintf(stderr, "Completed %d divisions\n", 32 * digits);
  print_bignum(powers, digits);
}
