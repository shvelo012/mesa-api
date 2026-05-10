import {
  Table,
  Column,
  Model,
  DataType,
  BelongsTo,
  ForeignKey,
  PrimaryKey,
  Default,
} from "sequelize-typescript";
import { Floor } from "./Floor";

@Table({ tableName: "walls" })
export class Wall extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column(DataType.FLOAT)
  declare x1: number;

  @Column(DataType.FLOAT)
  declare y1: number;

  @Column(DataType.FLOAT)
  declare x2: number;

  @Column(DataType.FLOAT)
  declare y2: number;

  @ForeignKey(() => Floor)
  @Column(DataType.UUID)
  declare floorId: string;

  @BelongsTo(() => Floor)
  declare floor: Floor;
}
