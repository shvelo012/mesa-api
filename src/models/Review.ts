import {
  Table,
  Column,
  Model,
  DataType,
  BelongsTo,
  ForeignKey,
  PrimaryKey,
  Default,
  AllowNull,
  CreatedAt,
  UpdatedAt,
  Unique,
} from "sequelize-typescript";
import { User } from "./User";
import { Restaurant } from "./Restaurant";

@Table({
  tableName: "reviews",
  indexes: [{ unique: true, fields: ["userId", "restaurantId"] }],
})
export class Review extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @ForeignKey(() => Restaurant)
  @Column(DataType.UUID)
  declare restaurantId: string;

  @BelongsTo(() => Restaurant)
  declare restaurant: Restaurant;

  @Column(DataType.INTEGER)
  declare stars: number;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare text: string | null;

  @Default(false)
  @Column(DataType.BOOLEAN)
  declare edited: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
