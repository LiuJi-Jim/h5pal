//
// PAL DOS compress format (YJ_1) library
//
// Author: Lou Yihua <louyihua@21cn.com>
//
// Copyright 2006 - 2007 Lou Yihua
//
// This file is part of PAL library.
//
// This library is free software; you can redistribute it and/or
// modify it under the terms of the GNU Lesser General Public
// License as published by the Free Software Foundation; either
// version 2.1 of the License, or (at your option) any later version.
//
// This library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
// Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public
// License along with this library; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA
//

// Ported to C from C++ and modified for compatibility with Big-Endian
// by Wei Mingzhi <whistler@openoffice.org>.

// TODO: fix YJ_2 for big-endian

/**
 * @module yj_1
 */
import utils from './utils';

var TreeNode = function() {
  /*
  unsigned char   value;
  unsigned char   leaf;
  unsigned short  level;
  unsigned int    weight;

  struct TreeNode *parent;
  struct TreeNode *left;
  struct TreeNode *right;
  */
  /*
  this.value = 0;
  this.leaf = false;
  this.level = 0;
  this.weight = 0;

  this.parent = this.left = this.right = null;
  */
}
TreeNode.SIZE = (1 + 1 + 2 + 4 + 4 + 4 + 4);

var TreeNodeList = function(){
  /*
  this.node = null;
  this.next = null;
  */
}

var YJ_1_FILEHEADER = function(buf) {
  /*
  unsigned int   Signature;          // 'YJ_1'
  unsigned int   UncompressedLength; // size before compression
  unsigned int   CompressedLength;   // size after compression
  unsigned short BlockCount;       // number of blocks
  unsigned char Unknown;
  unsigned char HuffmanTreeLength; // length of huffman tree
  */
  if (buf) {
    this.buffer = buf;
    //this.Signature = read4Bytes(buf, 0);          // 'YJ_1'
    this.Signature = readString(buf, 0, 4);
    this.UncompressedLength = read4Bytes(buf, 4); // size before compression
    this.CompressedLength = read4Bytes(buf, 8);   // size after compression
    this.BlockCount = read2Bytes(buf, 12);        // number of blocks
    this.Unknown = buf[14];
    this.HuffmanTreeLength = buf[15]; // length of huffman tree
  } else {
    /*
    this.Signature = '';
    this.UncompressedLength = 0;
    this.CompressedLength = 0;
    this.BlockCount = 0;
    this.Unknown = 0;
    this.HuffmanTreeLength = 0;
    */
  }
}

var YJ_1_BLOCKHEADER = function(buf) {
  /*
  unsigned short UncompressedLength; // maximum 0x4000
  unsigned short CompressedLength;   // including the header
  unsigned short LZSSRepeatTable[4];
  unsigned char LZSSOffsetCodeLengthTable[4];
  unsigned char LZSSRepeatCodeLengthTable[3];
  unsigned char CodeCountCodeLengthTable[3];
  unsigned char CodeCountTable[2];
  */
  if (buf) {
    this.buffer = buf;
    this.UncompressedLength = read2Bytes(buf, 0); // maximum 0x4000
    this.CompressedLength = read2Bytes(buf, 2);   // including the header
    if (!this.CompressedLength) {
      this.LZSSRepeatTable = new Uint16Array(4);
      this.LZSSOffsetCodeLengthTable = new Uint8Array(4);
      this.LZSSRepeatCodeLengthTable = new Uint8Array(3);
      this.CodeCountCodeLengthTable = new Uint8Array(3);
      this.CodeCountTable = new Uint8Array(2);
      return;
    }
    var offset = buf.byteOffset;
    this.LZSSRepeatTable = new Uint16Array(buf.buffer, offset + 4, 4);
    this.LZSSOffsetCodeLengthTable = new Uint8Array(buf.buffer, offset + 12, 4);
    this.LZSSRepeatCodeLengthTable = new Uint8Array(buf.buffer, offset + 16, 3);
    this.CodeCountCodeLengthTable = new Uint8Array(buf.buffer, offset + 19, 3);
    this.CodeCountTable = new Uint8Array(buf.buffer, offset + 22, 2);
  } else {
    /*
    this.UncompressedLength = 0;
    this.CompressedLength = 0;
    */
    this.LZSSRepeatTable = new Uint16Array(4);
    this.LZSSOffsetCodeLengthTable = new Uint8Array(4);
    this.LZSSRepeatCodeLengthTable = new Uint8Array(3);
    this.CodeCountCodeLengthTable = new Uint8Array(3);
    this.CodeCountTable = new Uint8Array(2);
  }
}
var bitptr;

/**
 * get_bits
 * @param  {Uint8Array} src
 * @param  {Number} count
 * @return {Number}
 */
function get_bits(src, count) {
  // WARNING 重构了，因为多返回值
  //var temp = (new Uint16Array(src.buffer, src.byteOffset)).subarray(bitptr >> 4);
  //var temp = src.subarray((bitptr >> 4) << 1);
  var tempOffset = (bitptr >> 4) << 1;
  var bptr = bitptr & 0xf;
  var mask;
  var ret;
  bitptr += count;
  if (count > 16 - bptr) {
    count = count + bptr - 16;
    mask = 0xffff >> bptr;
    //return ((temp[0] & mask) << count) | (temp[1] >> (16 - count));
    //return (((temp[0] | (temp[1] << 8)) & mask) << count) | ((temp[2] | (temp[3] << 8)) >> (16 - count));
    return (((src[tempOffset + 0] | (src[tempOffset + 1] << 8)) & mask) << count) | ((src[tempOffset + 2] | (src[tempOffset + 3] << 8)) >> (16 - count));
  } else {
    //return ((temp[0] << bptr) & 0xffff) >> (16 - count);
    //return ((((temp[0] | (temp[1] << 8)) << bptr) & 0xffff) >> (16 - count));
    return ((((src[tempOffset + 0] | (src[tempOffset + 1] << 8)) << bptr) & 0xffff) >> (16 - count));
  }
}

/**
 * get_loop
 * @param  {Uint8Array} src
 * @param  {YJ_1_BLOCKHEADER} header
 * @return {Number}
 */
function get_loop(src, header) {
  // WARNING 重构了，因为多返回值
  if (get_bits(src, 1)) {
    return header.CodeCountTable[0];
  } else {
    var temp = get_bits(src, 2);
    if (temp) {
      return get_bits(src, header.CodeCountCodeLengthTable[temp - 1]);
    } else {
      return header.CodeCountTable[1];
    }
  }
}

/**
 * get_count
 * @param  {Uint8Array} src
 * @param  {YJ_1_BLOCKHEADER} header
 * @return {Number}
 */
function get_count(src, header) {
  // WARNING 重构了，因为多返回值
  var temp = get_bits(src, 2);
  if (temp) {
    if (get_bits(src, 1)) {
      return get_bits(src, header.LZSSRepeatCodeLengthTable[temp - 1]);
    } else {
      return header.LZSSRepeatTable[temp];
    }
  } else {
    return header.LZSSRepeatTable[0];
  }
}

var yj_1 = {};

/**
 * 解压缩一段YJ_1压缩的字节
 * @param {Uint8Array} Source
 * @return {Uint8Array} Destination
 */
yj_1.decompress = function(Source) {
  utils.startTiming('Decompress:' + Source.length);
  var hdr = new YJ_1_FILEHEADER(Source, 0);
  var src = Source,
      Destination = new Uint8Array(hdr.UncompressedLength),
      dest = Destination,
      i,
      root, node;
  //if (SWAP32(hdr.Signature) != 0x315f4a59)
  if (hdr.Signature != 'YJ_1')
    return new Uint8Array(0);
  //if (SWAP32(hdr.UncompressedLength) > DestSize)
  //  return -1;

  do {
    var tree_len = hdr.HuffmanTreeLength * 2;

    var flag = src.subarray(16 + tree_len);
    bitptr = 0;

    //if ((node = root = (TreeNode *)malloc(sizeof(TreeNode) * (tree_len + 1))) == NULL)
    //   return -1;
    root = utils.initArray(TreeNode, tree_len + 1);
    root[0].leaf = 0;
    root[0].value = 0;
    root[0].left = 1; // WARNING 这里把指针改成索引了！！！
    root[0].right = 2;
    for (i = 1; i <= tree_len; i++) {
      root[i].leaf = !get_bits(flag, 1);
      root[i].value = src[15 + i];
      if (root[i].leaf) {
        root[i].left = root[i].right = -1;
      } else {
        root[i].left =  (root[i].value << 1) + 1;
        root[i].right = root[i].left + 1;
      }
    }
    src = src.subarray(16 + tree_len + (((tree_len & 0xf) ? (tree_len >> 4) + 1 : (tree_len >> 4)) << 1));
  } while (0);

  for (i = 0; i < SWAP16(hdr.BlockCount); i++) {
    var header = new YJ_1_BLOCKHEADER(src);
    src = src.subarray(4);
    if (!SWAP16(header.CompressedLength)) {
       var hul = SWAP16(header.UncompressedLength);
       while (hul--) {
          dest[0] = src[0];
          dest = dest.subarray(1);
          src = src.subarray(1);
       }
       continue;
    }
    src = src.subarray(20);
    bitptr = 0;
    for (;;) {
      var loop;
      loop = get_loop(src, header);
      if (loop == 0) {
        break;
      }

      while (loop--) {
        node = 0;
        for(; !root[node].leaf;) {
          if (get_bits(src, 1)) {
            node = root[node].right;
          } else {
            node = root[node].left;
          }
        }
        dest[0] = root[node].value;
        dest = dest.subarray(1);
      }

      loop = get_loop(src, header);
      if (loop == 0) {
        break;
      }

      while (loop--) {
        var pos, count;
        count = get_count(src, header);
        pos = get_bits(src, 2);
        pos = get_bits(src, header.LZSSOffsetCodeLengthTable[pos]);
        while (count--) {
          //*dest = *(dest - pos);
          //dest++;
          // 还负索引，真恶心- -"
          //dest[0] = dest.buffer[dest.byteOffset - pos];
          dest[0] = Destination[dest.byteOffset - pos];
          dest = dest.subarray(1);
        }
      }
    }
    src = header.buffer.subarray(SWAP16(header.CompressedLength));
  }

  utils.endTiming('Decompress:' + Source.length);
  return Destination;
}

export default yj_1;
